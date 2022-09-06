/**
 * Database synchronization implementations.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class DatabaseSync {
	
	/**
	 * options has to contain the following:
	 * 
	 * {
	 *     onLiveSyncChangeCallback(change, changeSequence, finalSequence) => void:  
	 *                                                Callback called when the live sync detected any changes.
	 *                                                Gets passed the change object from PouchDB.
	 *                                                
	 *     onManualSyncFinishedCallback() => Promise: Callback which gets involved when manual syncing finished.
	 *                                                Must return a Promise.
	 *                                                
	 *     updateSyncStatus: function() => void:      Update any sync state displays, because the sync has 
	 *                                                changed something possibly. 
	 *                                                
	 *     syncActiveHandler: function(info) => void: Called when syncing is active
	 *     
	 *     syncPausedHandler: function() => void:     Called when syncing paused
	 *                                                
	 *     alert: function(message, type) => void:    Messaging callback, called whenever the instance wants 
	 *                                                to show the user some message (with type [E,S,I,W,...])
	 *                                                
	 */
	constructor(dbHandler, options) {
		this.dbHandler = dbHandler;
		this.options = options;
	}
	
	/**
	 * Sets the sync state
	 */
	setSyncState(state) {
		this.syncState = state;
		if (this.options.updateSyncStatus) this.options.updateSyncStatus();
	}
	
	/**
	 * This listens to the local DBs change feed and sets the sync state to dirty when a change happens.
	 */
	observeChangeState(db) {
		if (!db) return;
		
		this.setSyncState("unknown");
		console.log("Starting changes feed to local DB ...");
		
		var that = this;
		this.observeHandler = db.changes({
			since: "now",
			live: true,
			filter: this.filter
		});
		
		if (!this.observeHandler) {
			this.options.alert('Error creating local observer', 'E');
			return;
		}
		
		this.observeHandler
		.on('change', function (change) {
			console.log("Observation: Change");
			that.setSyncState("dirty");
			
		}).on('error', function (err) {
			console.log("Observation: error");
			that.setSyncState("unknown");

			that.options.alert('Sync error: ' + err.message, 'E');

		}).on('complete', function (info) {
			console.log("Observation: Stopped");
			
			if (that.dbHandler.profileHandler.getCurrentProfile().clone) {
				that.setSyncState("unknown");
			}

		}).catch(function(err) {
			console.log("Observation: error");
			that.setSyncState("unknown");

			that.options.alert('Sync error: ' + err.message, 'E');
		});
	}
	
	/**
	 * Starts live syncing.
	 */
	syncLive() {
		var dbLocal = this.dbHandler.dbLocal;
		var dbRemote = this.dbHandler.dbRemote;
		
		if (!dbRemote || !dbLocal) return Promise.reject({
			message: "No databases set up to sync"
		});
		
		console.log("Starting live sync for databases");
		this.setSyncState("unknown");

		var syncedUrl = this.dbHandler.profileHandler.getCurrentProfile().url;
		
		var that = this;
		return this.dbHandler.login()
		.then(function(dataLogin) {
			if (!dataLogin.ok) {
				that.setSyncState("unknown");
				
				console.log(dataLogin);
				return Promise.reject({
					message: 'Sync login error: ' + dataLogin.message
				});
			};
			
			that.syncHandler = dbLocal.sync(dbRemote, {
				live: true,
				retry: true,
				filter: that.filter
			});
			
			if (!that.syncHandler) {
				console.log("Error: Could not start live sync.");
				that.setSyncState("unknown");
				that.dbHandler.notifyOfflineState();

				that.restartLiveSync(syncedUrl, "Restarting live sync after failed initialization");
				
				return Promise.reject({
					message: "Error: Could not start live sync."
				});
			}
			
			that.syncHandler.on('change', function (change) {
				if (!change.change.ok) {
					that.setSyncState("unknown");
				
					that.options.alert('Sync error(s): ' + change.change.errors, 'E');
					console.log(change);
					return;
				}
			
				// Check if the change reached the end
				var last_seq = that.extractSequence(change.change.last_seq);
				var dbChk = (change.direction == "pull") ? dbRemote : dbLocal;
				dbChk.info().then(function(dataInfo) {
					var update_seq = that.extractSequence(dataInfo.update_seq);
					var done = (update_seq == last_seq);
					that.setSyncState(done ? "ok" : "dirty");
					
					that.options.onLiveSyncChangeCallback(change, last_seq, update_seq);

					console.log("Sync: Change: " + (done ? 'final ' : '') + change.direction + " to sequence " + last_seq);
				});

			}).on('paused', function (err) {
				console.log("Sync: Paused");

				if (err) {
					that.options.alert('Sync error: ' + err, 'E');
					console.log(err);

					that.setSyncState("unknown");
					return;
				}

				that.setSyncState("paused");

				// Check connection to remote DB here, telling the user if the pause has to do with a lost connection
				that.checkOnlineStatus();
				
				if (that.options.syncPausedHandler) {
					that.options.syncPausedHandler();
				}

			}).on('active', function (info) {
				console.log("Sync: Active");
				that.setSyncState("syncing");
				that.dbHandler.notifyOfflineState();
				
				if (that.options.syncActiveHandler) {
					that.options.syncActiveHandler(info);
				}

			}).on('error', function (err) {
				that.options.alert('Sync error: ' + err.message, 'E');
				console.log(err);
				that.dbHandler.notifyOfflineState();

				that.setSyncState("unknown");

				// Show Login if the error is 401
				if (err.status == 401) {
					that.dbHandler.login().catch(function(err) {
						that.options.alert('Error logging in: ' + err.message, 'E');
						console.log(err);
					});
				}
				
				that.restartLiveSync(syncedUrl, "Restarting live sync after sync error: " + err.status);

			}).on('complete', function (info) {
				console.log("Sync: Stopped");

				if (that.dbHandler.profileHandler.getCurrentProfile().clone) {
					that.setSyncState("unknown");
				}

				that.restartLiveSync(syncedUrl, "Restarting live sync after completion");

			}).catch(function(err) {
				console.log(err);
				that.dbHandler.notifyOfflineState();
				
				that.restartLiveSync(syncedUrl, "Restarting live sync after exception");
			});
			
			return Promise.resolve({
				ok: true
			});

		}).catch(function(err) {
			console.log(err);
			that.dbHandler.notifyOfflineState();
			
			that.restartLiveSync(syncedUrl, "Restarting live sync after exception");
			
			return Promise.reject({
				message: err.message
			});
		});
	}
	
	/**
	 * Restart live sync after a few seconds. The passed syncedUrl must be the url for which the
	 * live sync has been started initially.
	 */
	restartLiveSync(syncedUrl, msg) {
		if (this.dbHandler.profileHandler.getCurrentProfile().url != syncedUrl) {
			console.log(' -> Canceling sync restart after profile change');
			return;
		}
		if (this.dbHandler.profileHandler.getCurrentProfile().autoSync) {
			var that = this;
			setTimeout(function() {
				if (that.dbHandler.profileHandler.getCurrentProfile().url == syncedUrl) {
					if (msg) console.log(msg);
					that.syncLive();
				} else {
					console.log(' -> Not executing delayed sync restart after profile change');
				}
			}, 5000);
		}
	}
	
	/**
	 * Extract the update sequency number (from CouchDB this is postfixed with some UUID, while
	 * from PouchBD a clear integer is delivered)
	 */
	extractSequence(subj) {
		if(typeof subj == "string") {
			var splt = subj.split('-');
			if (splt && splt.length > 0) {
				return parseInt(splt[0]);
			}
		}
		return subj;
	}
	
	/**
	 * Manually sync the local and remote databases, if in clone mode.
	 */
	syncManually() {
		var that = this;

		if (!this.waitFinished(function() { 
			that.syncManually();
		})) return;
		
		var dbLocal = this.dbHandler.dbLocal;
		var dbRemote = this.dbHandler.dbRemote;
		if (!dbLocal || !dbRemote) return;

		this.options.alert('Starting synchronization...', 'I');
		
		this.blocked = true;
		this.setSyncState( "syncing");
		console.log("Syncing databases ...");
		
		this.dbHandler.login().then(function(data) {
			dbLocal.sync(dbRemote, {
				filter: that.filter
			}).then(function(data) {
				if (!data.pull || !data.pull.ok) {
					that.dbHandler.notifyOfflineState();
					that.options.alert('Pull error: ' + data.pull.message, 'E');
					that.blocked = false;
					console.log(data);
					return;
				}
				if (!data.push || !data.push.ok) {
					that.dbHandler.notifyOfflineState();
					that.options.alert('Push error: ' + data.push.message, 'E');
					that.blocked = false;
					console.log(data);
					return;
				}
	
				console.log("Synced databases OK");
				
				return that.options.onManualSyncFinishedCallback()
				.then(function(dataResp) {
					that.dbHandler.refresh();
					that.options.alert('Successfully synchronized database.', 'S');
					
					that.blocked = false;

					// Set status
					if (data.pull.status == "complete" && data.push.status == "complete") {
						that.setSyncState("ok");
					} else {
						that.setSyncState("dirty");
					}
					
				}).catch(function(err) {
					that.options.alert('Sync callback error: ' + err.message, 'E');
					that.dbHandler.notifyOfflineState();
					that.setSyncState( "error");
					
					that.blocked = false;
					console.log(err);
				});

			}).catch(function(err) {
				that.options.alert('Sync error: ' + err.message, 'E');
				that.dbHandler.notifyOfflineState();
				that.setSyncState( "error");

				that.blocked = false;
				console.log(err);
			});
		});
	}
	
	/**
	 * Stops all sync activity. 
	 * 
	 * TODO This would be necessary to switch sync modes on the fly. This
	 * is however not so important, currently the page is reloaded in these cases directly in Settings.
	 */
	stopAllSync() {
		if (this.syncHandler) {
			console.log("Canceling live sync...");
			this.syncHandler.cancel();				
			this.syncHandler = null;
			this.setSyncState("");
		}
		if (this.observeHandler) {
			console.log("Canceling local observation sync...");
			this.observeHandler.cancel();
			this.observeHandler = null;
			this.setSyncState("");
		}
	}
	
	/**
	 * Filter function for remote replication
	 */
	filter(doc, params) {
		return true; // Unused currently
	}
	
	/**
	 * Checks if the remote db is online, for usage in the sync functions. Updates the sync status accordingly.
	 */
	checkOnlineStatus(db) {
		if (!db) return;
		
		var that = this;
		db.info().catch(function (data) {
			that.dbHandler.notifyOfflineState();
			
			that.setSyncState("unknown");
		});
	}
	
	/**
	 * Starts a consistency check, reported on the console view which is focused. Makes deep comparison between 
	 * the local and remote databases if in cloned/offline mode.
	 */
	checkConsistency(logCallback) {
		if (!logCallback) logCallback = Console.log;
		
		var dbLocal = this.dbHandler.dbLocal;
		var dbRemote = this.dbHandler.dbRemote;
		
		if (!dbLocal || !dbRemote) {
			logCallback('This check is only possible in clone mode.', 'E');
			return Promise.reject({
				message: 'This check is only possible in clone mode.'
			});
		}
		
		var ph = this.dbHandler.profileHandler;

		if (!ph.getCurrentProfile().clone || !dbLocal || !dbRemote) {
			logCallback('This check is only possible in clone mode.', 'E');
			return Promise.reject({
				message: 'This check is only possible in clone mode.'
			});
		}
		
		logCallback("Starting consistency check between local and " + ph.getCurrentProfile().url);

		// Load all docs from both databases and compare them one by one (incl. attachments!)
		var dataLocal;
		var dataRemote
		var errors = [];

		var that = this;
		return dbLocal.allDocs({
			include_docs: true,
			attachments: true,
			conflicts: true
		})
		.then(function(dl) {
			dataLocal = dl;
			
			return dbRemote.allDocs({
				include_docs: true,
				attachments: true,
				conflicts: true
			});
		})
		.then(function(dr) {
			dataRemote = dr;
				
			// Compare docs
			var numType = (dataLocal.rows.length == dataRemote.rows.length) ? "I" : "E";
			logCallback();
			logCallback("Number of local documents: " + dataLocal.rows.length, numType);
			logCallback("Number of remote documents: " + dataRemote.rows.length, numType);
			logCallback();
			
			for(var l in dataLocal.rows) {
				logCallback("Checking " + dataLocal.rows[l].id + (dataLocal.rows[l].doc.name ? (" (" + dataLocal.rows[l].doc.name + ")") : ""));
				
				// Search remote counterpart
				var found = false;
				//for (var r=0; r<dataRemote.rows.length; ++r) {
				for(var r in dataRemote.rows) {
					if (dataLocal.rows[l].id == dataRemote.rows[r].id) {
						found = true;
						break;
					}
				}
				if (!found) {
					errors.push({
						message: dataLocal.rows[l].id + " not found on remote",
						id: dataLocal.rows[l].id,
						type: 'E'
					});
					logCallback(" -> Error: Not found on remote", "E");
					continue;
				}
				
				// Counterpart found: Compare contents. For this we have to remove some attributes first 
				// from the attachments which are installation dependent.
				that.stripInstallationDependentProps(dataLocal.rows[l].doc);
				that.stripInstallationDependentProps(dataRemote.rows[r].doc);
				
				var resultList = [];
				Tools.compareObjects(dataLocal.rows[l].doc, dataRemote.rows[r].doc, resultList);
				if (resultList.length > 0) {
					errors.push({
						message: dataLocal.rows[l].id + ": Documents not identical, Details:",
						id: dataLocal.rows[l].id,
						type: 'E'
					});
					for(var i in resultList) {
						logCallback("    " + resultList[i], 'E');
						errors.push({
							message: resultList[i],
							id: dataLocal.rows[l].id,
							type: 'E'
						});
					}

					logCallback(" -> Error: Documents not identical!", "E");
					continue;
				}
			}
			
			logCallback();
			logCallback("Finished consistency check.");
			logCallback();
			logCallback("Number of documents in error: " + errors.length, (errors.length > 0) ? "E" : "I");
			
			var ok = errors.length == 0;
			if (ok) {
				errors.push({
					message: 'All ' + dataLocal.rows.length + ' documents checked OK',
					type: 'S'
				});
			}
			return Promise.resolve({
				numChecked: dataLocal.rows.length,
				errors: errors,
				ok: ok
			});
		})
		.catch(function(err) {
			that.options.alert('Check throwed an error: ' + err.message, 'E');
			that.dbHandler.notifyOfflineState();
			
			logCallback(err);
			
			return Promise.reject(err);
		});
	}
	
	/**
	 * Strips the digests and revisions from the passed document's attachments. These are not
	 * the same among DBs, as they are installation dependent.
	 */
	stripInstallationDependentProps(doc) {
		if (!doc.hasOwnProperty("_attachments")) return;
			
		for (var i in doc._attachments) {
			var a = doc._attachments[i];
			a.digest = "";
			a.revpos = 0;
		}
	}
	
	/**
	 * Executes the passed function as long as the app is saving.
	 */
	waitFinished(func) {
		while(this.blocked) {
			setTimeout(func, 100);
			return false;
		}
		return true;
	}
}