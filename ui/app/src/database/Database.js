/**
 * Database setup for PouchDB with local and remote instances, allowing 
 * for different modes of interaction.
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
class Database {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Database.instance) Database.instance = new Database();
		return Database.instance;
	}
	
	/**
	 * Must be called before usage of the class. Following options are available:
	 * 
	 * notifyOfflineCallback: Called when there could potentially be a 
	 *                        problem with the Internet connection. The
	 *                        callback program can then perform further checks
	 *                        to detect offline state for example.
	 *                        No parameters. Optional.
	 *                        
	 * refreshAppCallback:    Called to refresh the application.
	 *                        No parameters. Optional.
	 *                     
	 * syncOptions:           Callbacks for the sync handler, see DatabaseSync constructor.
	 *                        Mandatory.
	 *                        
	 * profileOptions:        Callbacks for the profile handler, see ProfileHandler constructor.
	 *                        Mandatory.
	 */
	options(o) {
		this.options = o;
		
		this.profileHandler = new ProfileHandler(this, this.options.profileOptions);
		this.syncHandler = new DatabaseSync(this, this.options.syncOptions);
	}
	
	/**
	 * Controls if the login form auto submits if the browser auto completed it.
	 * DEPRECATED! Auto login is no longer used, replaced by "trusted device" option
	 *
	setAutoLoginBlock(lock) {
		this.blockAutoLogin = !!lock;
	}
	
	/**
	 * Initialize database instance(s). Called only once at launch. 
	 * Returns a Promise.
	 */
	init() {
		//this.blockAutoLogin = false;
		
		if (this.isInitialised()) return Promise.resolve({
			ok: true
		});
		
		var profile = this.profileHandler.getCurrentProfile();
		
		if (!profile) {
			return Promise.reject({
				ok: false,
				message: '"No profile could be loaded."',
				messageThreadId: 'DBInitMessages'
			});
		}
		
		console.log("Initialize database(s) with profile " + profile.url);

		// Create PouchDB instance
		if (!profile.url || profile.url == "local") {
			// No remote: Just use a local database.
			this.dbLocal = this.createLocalDatabase(this.determineLocalDbName(profile.url)); 
			this.db = this.dbLocal;
			
			this.syncHandler.setSyncState("offline");
			
			return Promise.resolve({
				ok: true,
				initialised: true
			});
		} else {
			if (profile.clone) {
				this.dbLocal = this.createLocalDatabase(this.determineLocalDbName(profile.url));
				this.db = this.dbLocal;
				//console.log('Created local database');
			}

			var that = this;
			return this.createRemoteDatabase(profile.url)
			.then(function(data) {
				if (!data.ok || !data.db) {
					that.notifyOfflineState();
					
					return Promise.reject({
						ok:false,
						message: "Error creating database: " + data.message,
						messageThreadId: 'DBInitMessages'
					});
				}
				
				that.dbRemote = data.db;
				//console.log('Created remote database');

				if (profile.clone) {
					// Start change feeds if in clone mode
					if (profile.autoSync) {
						// AutoSync: This starts the sync feed which is then kept alive for all time
						that.syncHandler.syncLive();

					} else {
						// No AutoSync: Listen to the local DB change feed to get local changes and set the status icon accordingly. 
						that.syncHandler.observeChangeState(that.dbLocal);
					}
				} else {
					that.db = that.dbRemote;
					that.syncHandler.setSyncState("offline");
				}
				
				return Promise.resolve({
					ok: true,
					initialised: true
				});
				
			}).then(function(data) {
				return Promise.resolve({
					ok: true,
					initialised: true
				});
			});
		}
	}
	
	/**
	 * Reset instance
	 */
	reset() {
		//console.log("Resetting databases");
		this.syncHandler.stopAllSync();

		this.db = null;
		this.dbLocal = null;
		this.dbRemote = null;
	}
	
	/**
	 * Returns if there is any DB connection
	 */
	isInitialised() {
		return !!(this.dbLocal || this.dbRemote);
	}
	
	/**
	 * Logs the current user in to a database. Returns a promise.
	 * promtUser set to true will ask for a user name in any case.
	 */
	login(db, promtUser) {
		if (!db) db = this.dbRemote;
		if (!db) {
			this.loggedInUser = false;
			return Promise.reject({ 
				message: 'No remote database to log in to',
				messageThreadId: 'DBLoginMessages'
			});
		}
		
		if (!Tools.isOnline()) {
			this.loggedInUser = false;
			return Promise.reject({ 
				ok: false, 
				message: 'You have no internet connection.',
				messageThreadId: 'DBLoginMessages'
			});
		}

		if ($('#login').css('display') == 'block') {
			this.notifyOfflineState();
			
			return Promise.reject({
				message: 'Login already running',
				messageThreadId: 'DBLoginMessages'
			});
		}

		var that = this;
		return new Promise(function(resolve, reject) {
			db.getSession(function (err, response) {
				if (response && response.ok && response.userCtx.name) {
					that.loggedInUser = response.userCtx.name;
					
					if (!promtUser) {
						console.log("Logged in as " + response.userCtx.name);
						resolve({
							ok: true
						});
						return;
					}
				} else {
					that.loggedInUser = false;
				}
				
				that.checkRemoteConnection()
				.then(function(data) {
					
					function doLogin(usr, pwd, trust) {
						db.login(usr, pwd, function (err, response) {
							$('#login').css('display', 'none');
							
							if (err) {
								that.notifyOfflineState();
								
								console.log("Connecting error: " + err.message);
								
								reject({
									ok: false,
									message: err.message,
									messageThreadId: 'DBLoginMessages'
								});
							} else {
								console.log("Connected successfully with user " + usr);
								that.loggedInUser = usr;
								
								that.refresh();

								// Trust the device?
								if (trust) {
									ClientState.getInstance().setTrustedDeviceCredentials(usr, pwd);
								} else {
									ClientState.getInstance().setTrustedDeviceCredentials();
								}

								resolve({
									ok: true
								});
							}
							
						}).catch(function(err) {
							$('#login').css('display', 'none');
							
							that.notifyOfflineState();
							
							console.log("Connection error: " + err.message);
							
							reject({
								ok: false,
								message: err.message,
								messageThreadId: 'DBLoginMessages'
							});
						});
					}
					
					function submitLogin(event) {
						$(document).off('keypress', loginKeyPressed);
											
						const pwd = $('#pwdInput').val();
						const usr = $('#username').val();
						const trustDev = !!$('#trustInput').prop('checked');

						if (!pwd || (pwd.length == 0)) {
							reject({
								ok: false,
								message: 'Please enter a password',
								messageThreadId: 'DBLoginMessages'
							});
							return;
						}
						
						doLogin(usr, pwd, trustDev);
					}
					
					function loginCancel(event) {
						$('#login').css('display', 'none');
						$(document).off('keypress', loginKeyPressed);
						
						reject({
							ok: false,
							message: 'Login cancelled.',
							messageThreadId: 'DBLoginMessages'
						});
					}
					
					function loginKeyPressed(e) {
					    if(e.which == 13) {
					    	submitLogin(e);
					    }
					}
					
					// Is this device trusted?
					if (ClientState.getInstance().isDeviceTrusted()) {
						const trustedCredentials = ClientState.getInstance().getTrustedDeviceCredentials();
						console.log('Device is trusted: ' + trustedCredentials.user);
						
						doLogin(trustedCredentials.user, trustedCredentials.password, true);
						return;
					}
					
					console.log('Showing login');

					$('#login').css("display", "block");
					$('#loginForm').attr('method', 'post');
					
					$(document).off('keypress', loginKeyPressed);
					$(document).on('keypress', loginKeyPressed);
					
					$('#loginCancelButton').off('click');
					$('#loginCancelButton').on('click', loginCancel);
					
					$('#loginSubmitButton').off('click');	
					$('#loginSubmitButton').on('click', submitLogin);	

					$('#loginSubmitButton').focus();
					
					// Check if the browser auto completed the fields and submit automatically in this case.
					/*if (!that.blockAutoLogin) {
						setTimeout(function() {
							var pwdPre = $('#pwdInput').val();
							var usrPre = $('#username').val();
							
							if (pwdPre && usrPre && (pwdPre.length > 0) && (usrPre.length > 0)) {
								submitLogin();
							}
						}, 500);
					}*/
					
				}).catch(function(err) {
					that.notifyOfflineState();
					
					reject({
						ok: false,
						message: 'Could not connect to database: ' + err.message,
						messageThreadId: 'DBLoginMessages'
					});
				});
			});
		});
	}
	
	/**
	 * Returns the user logged in, or falsy if no login exists.
	 */
	getLoggedInUser() {
		return this.loggedInUser;
	}
	
	/**
	 * Logs the user out. Returns a promise.
	 */
	logout(db) {
		if (!db) db = this.dbRemote;
		if (!db) return Promise.reject({ message: 'There is no active remote connection to log out from.' });
		
		var that = this;
		return new Promise(function(resolve, reject) {
			that.dbRemote.logout(function (err, response) {
				console.log(err);
				console.log(response);
				that.loggedInUser = false;
				
				resolve({
					ok: true,
				});
			}).catch(function(err) {
				reject({
					message: err.message,
					messageThreadId: 'DBLogoutMessages'
				});
			});
		});
	}
	
	/**
	 * Create a local PouchDB instance. Directly returns the instance.
	 */
	createLocalDatabase(url) {
		//console.log("Creating local database instance " + url);
		return new PouchDB(url);
	}
	
	/**
	 * Create a remote database. The instance is returned as Promise.
	 */
	createRemoteDatabase(url) {
		return new Promise(function(resolve, reject) {
			var ndb = new PouchDB(url, {
				skip_setup: true
			});
			
			resolve({
				ok: true,
				db: ndb
			});
		});
	}
	
	/**
	 * Generates the db name for local database (out of the URL of its remote counterpart).
	 * Omit url to use the current one.
	 */
	determineLocalDbName(url) {
		if (!url) url = this.profileHandler.getCurrentProfile().url;
		if (!url || url == "local") return "notes_local";
		return "notes_" + url.replace(/[^a-zA-Z0-9_]/g, "");
	}
	
	/**
	 * Removes the local database of the passed remote url. Omit url to use the current one.
	 */
	clearLocalDatabase() {
		if (!this.dbLocal) return null;
		console.log("Clearing local database");
		return this.dbLocal.destroy();
	}
	
	/**
	 * Prepares a remote URL for usage as database URL. This ensures a http prefix etc.
	 */
	prepareNewRemoteUrl(url) {
		if (url == "local") return url;
		if (!/^https?:\/\//i.test(url)) {
		    url = 'http://' + url;
		}
		return url;
	}
	
	/**
	 * Check DB connection (for dialog usage, namely in the settings view). Returns a Promise.
	 */
	checkRemoteConnection() {
		var status = "Status: Unknown";
		
		if (!this.dbRemote) {
			return Promise.resolve({ 
				message: "No remote DB connected",
				messageThreadId: 'DBCheckRemoteMessages'
			});
		} else {
			var that = this;
			return that.dbRemote.info()
			.then(function(data) {
				if (!data.db_name) {
					that.notifyOfflineState();
					
					return Promise.reject({ 
						message: "Could not connect to database",
						messageThreadId: 'DBCheckRemoteMessages'
					});
				} else {
					return Promise.resolve({ 
						ok: true, 
						message: "Connected to database " + data.db_name + " over " + data.adapter  + " <br>Head sequence: " + that.syncHandler.extractSequence(data.update_seq),
						messageThreadId: 'DBCheckRemoteMessages'
					});
				}
			});
		}
	}
	
	/**
	 * Check DB login status (for dialog usage, namely in the settings view). Returns a Promise.
	 */
	checkRemoteLogin() {
		var status = "Login status unknown";
		
		if (!this.dbRemote) {
			this.loggedInUser = false;
			return Promise.resolve({ 
				message: "No remote DB connected",
				messageThreadId: 'DBCheckRemoteMessages'
			});
		} else {
			var that = this;
			return this.dbRemote.getSession()
			.then(function(data) {
				if (!data.ok || !data.userCtx || !data.userCtx.name) {
					that.loggedInUser = false;
					return Promise.reject({ 
						message: "Not logged in",
						messageThreadId: 'DBCheckRemoteMessages'
					});
				} else {
					that.loggedInUser = data.userCtx.name;
					return Promise.resolve({ 
						ok: true, 
						message: "Logged in as " + data.userCtx.name,
						messageThreadId: 'DBCheckRemoteMessages'
					});
				}
				
			}).catch(function(err) {
				that.notifyOfflineState();
				
				return Promise.reject({ 
					message: "Error getting session info " + err.message,
					messageThreadId: 'DBCheckRemoteMessages'
				});
			});
		}
	}
	
	/**
	 * Replicates the local database to a remote.
	 */
	replicateLocalTo(url) {
		if (!this.dbLocal) {
			Console.log("Replication is only possible when a remote DB instance is set up.", 'E');
			return Promise.reject({ message: 'No local db set up' });
		}
		
		Console.log("Replicating local database to " + url + "...");
		
		var that = this;
		var dbr;
		return this.createRemoteDatabase(url)
		.then(function(data) {
			if (!data.ok) {
				Console.log("Error creating remote database for " + url + ": " + data.message, 'E');
				that.notifyOfflineState();
				
				return Promise.reject(data);
			}
			
			dbr = data.db;
			return that.login(dbr, true);
			
		}).then(function(data) {
			if (!data.ok) {
				Console.log("Error: " + data.message, 'E');
				that.notifyOfflineState();
				
				return Promise.reject(data);
			}
			
			Console.log("Starting replication...");
			
			return new Promise(function(resolve, reject) {
				PouchDB.replicate(that.dbLocal, dbr)
				.on('change', function (info) {
					Console.log(" -> Sending Changes...");
					
				}).on('paused', function (err) {
					Console.log(" -> Paused...");
					
				}).on('denied', function (err) {
					Console.log(" -> Denied: " + err.message, 'E');
					reject({
						ok: false,
						message: err.message,
						messageThreadId: 'DBReplicateMessages'
					});
					
				}).on('complete', function (info) {
					Console.log(" -> Replication finished, info: ");
					Console.log(info);
					resolve({ 
						ok: true, 
						info: info 
					});
					
				}).on('error', function (err) {
					Console.log(" -> Error: " + err.message, 'E');
					reject({
						ok: false,
						message: err.message,
						messageThreadId: 'DBReplicateMessages'
					});
					
				}).catch(function(err) {
					Console.log(" -> Error: " + err.message, 'E');
					reject({
						ok: false,
						message: err.message,
						messageThreadId: 'DBReplicateMessages'
					});
				});
			});
		});
	}
	
	/**
	 * Returns an admin (Fauxton) link for the DB at url
	 */
	getAdminLink(url) {
		if (!url) url = this.profileHandler.getCurrentProfile().url;
		if (!url || url == "local") return false;
		
		var dburl = url.substring(0, url.lastIndexOf('/'));
		return dburl + "/_utils";
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Tries to notify the application that there could be a problem with the Internet connection.
	 */
	notifyOfflineState() {
		if (this.options && this.options.notifyOfflineCallback) {
			this.options.notifyOfflineCallback();
		}
	}

	/**
	 * Tries to refresh the application.
	 */
	refresh() {
		if (this.options && this.options.refreshAppCallback) {
			this.options.refreshAppCallback();
		}
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Checks conflicts
	 */
	checkConflicts(docId) {
		var errors = [];
		
		var db;
		return this.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.get(docId, {
				conflicts: true
			})
			.catch(function(/*err*/) {
				errors.push({
					message: 'Document ' + docId + ' not found',
					id: docId,
					type: 'E'
				});
				return Promise.reject({
					errors: errors
				});
			});
		})
		.then(function(doc) {
			if (!doc) {
				errors.push({
					message: 'Document ' + docId + ' not found (2)',
					id: docId,
					type: 'E'
				});
				return Promise.reject({
					errors: errors
				});
			} 
			
			if (doc._conflicts && doc._conflicts.length > 0) {
				for(var c in doc._conflicts) {
					errors.push({
						message: 'Confict detected: ' + doc._conflicts[c],
						id: docId,
						type: 'E'
					});
				}
				return Promise.reject({
					errors: errors
				});
			} else {
				errors.push({
					message: 'No conflicts detected for ' + docId,
					id: docId,
					type: 'S'
				})
				return Promise.resolve({
					errors: errors,
					ok: true
				});
			}
		});
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns the PouchDB instance to be used for DB reading and manipulation, as a promise.
	 * This is called by the application whenever a DB connection is needed.
	 * 
	 * NOTE: Do not buffer this!
	 */
	get() {
		if (!this.db) return Promise.reject({ 
			ok: false, 
			message: 'No db set up',
			messageThreadId: 'DBGetMessages'
		});
	
		// Local db never needs authentication
		if (this.db == this.dbLocal) {
			return Promise.resolve(this.db);
		}

		// There is a remote DB and it needs authentication: Check if we are still logged in
		var that = this;
		return this.login()
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject({
					ok: false,
					message: data.message,
					messageThreadId: 'DBGetMessages'
				});
			}
			
			return Promise.resolve(that.db);
		});
	}
}