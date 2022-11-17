/**
 * Note taking app - Main application controller class.  
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
class Notes { 
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Notes.instance) Notes.instance = new Notes();
		return Notes.instance;
	}
	
	constructor() { 
		this.appVersion = '0.96.6';      // Note: Also update the Cahce ID in the Service Worker to get the updates through to the clients!

		this.optionsMasterContainer = "treeoptions_mastercontainer";
		this.outOfDateFiles = [];
		this.currentPage = null;
	}
	
	/**
	 * Called initially on window load.
	 */
	init() { 
		var that = this;
		window.onerror = function errorHandler(msg, url, line, columnNo, error) {
			// This is for mobile device debugging: On IOS, no JS errors are visible, so 
			// we alert them here.
			if (that.isMobile()) {
				alert('Exception: ' + msg + ' in ' + url + ' line ' + line);
			}
			
			if (error && error.stack) {
				Console.log(error.stack, 'E');
			} else {
				Console.log(msg, 'E');
				Console.log('  at:    ' + url, 'E');
				Console.log('  line:  ' + line, 'E');
			} 
			
			// Just let the default handler run.
			return false;
		}

		// Enable caches for late loading of JS scripts
		$.ajaxSetup({
			cache: true
		});
		
		// Redirect console logging
		Console.getInstance().init();

		// Set up database callbacks.
		this.setupDatabaseCallbacks();
		
		// Reload or refresh page some milliseconds after resizing has stopped
		this.currentMobileState = this.isMobile();
		window.onresize = function() {
			if (that.resizeHandler) clearTimeout(that.resizeHandler);
			that.resizeHandler = setTimeout(function() {
				if (that.isMobile() != that.currentMobileState) {
					that.currentMobileState = that.isMobile();
					location.reload();
				} else {
					that.refresh();
				}
			}, 30);
		}
		
		// CTRL-S key to save
		$(window).bind('keydown', function(event) {
		    if (event.ctrlKey || event.metaKey) {
		        switch (String.fromCharCode(event.which).toLowerCase()) {
		        case 's':
		            event.preventDefault();
		            
		            var e = that.getCurrentEditor();
		            if (e && e.isDirty()) {
		            	e.stopDelayedSave();
		            	 
		            	that.showAlert("Saving " + e.current.name + "...", "I", "SaveMessages"); 
		            
		            	DocumentActions.getInstance().save(e.getCurrentId(), e.getContent())
						.then(function(data) {
		            		if (data.message) that.showAlert(data.message, "S", data.messageThreadId);
		            	})
						.catch(function(err) {
		            		that.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
		            	});
		            }
		            break;		        
		        }
		    }
		});

		// Messages/Alerts box setup
		this.showAlert("Welcome!", "I", false, true);
		$('#messages').click(function() { 
			$('#messages').empty();
		});	
		
		// Set up application routing
		this.routing = new Routing(this, '#article');
		
		// Start routing.
		this.routing.run();
	}
	
	/**
	 * Sets all callback handlers for the database
	 */
	setupDatabaseCallbacks() {
		var that = this;
		
		Database.getInstance().options({
			// Called whenever the DB instance has the doubt that there could be offline state.
			notifyOfflineCallback: function() {
				that.notifyOfflineState();
			},
			
			// Refresh the app
			refreshAppCallback: function() {
				that.refresh();
			},
			
			// Profile callbacks: These connect the profile handler to the local storage class ClientState.
			profileOptions: {
				saveProfilesCallback: function(arr) {
					ClientState.getInstance().saveProfiles({ profiles: arr });
				},
				getProfilesCallback: function() {
					return ClientState.getInstance().getProfiles().profiles;
				}
			},
			
			// Sync callbacks
			syncOptions: {
				// Message to the user
				alert: function(msg, type, threadId, alwaysHideAtNewMessage, callbackFunction) {
					that.showAlert(msg, type, threadId, alwaysHideAtNewMessage, callbackFunction);
				},
				
				// Update the sync state button in the header
				updateSyncStatus: function() {
					that.updateSyncStatus();
				},
				
				// Called after manually syncing. Just reloads the tree.
				onManualSyncFinishedCallback: function() {
					return Views.getInstance().updateViews()
					.then(function(resp) {
						if (resp.docCreated) {
							that.showAlert('Successfully initialized database views.', 'S');
						}
						return TreeActions.getInstance().requestTree();
					});
				},
				
				// Called at active syncing
				syncActiveHandler: function(info) {
				},
				
				// Called when syncing has paused.
				syncPausedHandler: function() {
					// If not yet done, check the views.
					if (!that.updatedViews) {
						that.updatedViews = true;

						Views.getInstance().updateViews()
						.catch(function(err) {
							that.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					}
				},
				
				// Called when the live sync (autoSync) gets changes. Checks if the changes are relevant to the tree or the
				// opened document, and reloads whatever needs to be reloaded.
				onLiveSyncChangeCallback: function(change, change_seq, final_seq) {
					//var a = Actions.getInstance();
					var e = that.getCurrentEditor();
					
					// Check if we need to update anything. This only applies when we get changes from the remote (pull).
					if (change.direction == "pull") {
						var percentage = 0;
						if (change_seq && final_seq) {
							percentage = parseFloat(change_seq) / parseFloat(final_seq);
						}
						
						// Progress bar
						that.showProgressBar(percentage);
						
						// Update loaded note if the changed document is currently opened
						if (e && change.change) {
							for(var i in change.change.docs || []) {
								var doc = change.change.docs[i];
								if (doc._id.startsWith('_')) continue;
								
								if (doc._id == e.getCurrentId()) {
									console.log("Sync: -> Re-requesting " + (doc.name ? doc.name : doc._id) + ", it has been changed and is opened in an Editor.");
									if (e.isDirty()) {
										e.stopDelayedSave();
										that.showAlert('Warning: ' + (doc.name ? doc.name : doc._id) + ' has been changed remotely. If you save now, the remote version will be overwritten! Reload the app to keep the server version.', 'W');
									} else {
										DocumentActions.getInstance().request(doc._id)
										.catch(function(err) {
											that.showAlert('Error loading note: ' + err.message, 'E', err.messageThreadId);
										})
									}
									break;
								}
							}
						}
						
						// In the final change, update views and trigger a tree request, reload global metadata.
						if (change_seq == final_seq) {
							that.showProgressBar(1);
							
							Views.getInstance().updateViews()
							.then(function(resp) {
								return MetaActions.getInstance().requestGlobalMeta()
								.catch(function(err) {
									that.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
								});
							})
							.then(function() {
								return TreeActions.getInstance().requestTree();
							})
							.catch(function(err) {
								that.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
							});
							return;
						}
						
						// Intermediate changes: Check for tree changes and trigger a reload when there are any relevant ones
						if (change.change) {
							var treeRequested = false;
							for(var i in change.change.docs || []) {
								var doc = change.change.docs[i];
								if (doc._id.startsWith('_')) continue;
								
								if (doc._id == MetaActions.metaDocId) {
									// Update global meta document if changed
									console.log("Sync: -> Re-requesting global metadata");
									
									MetaActions.getInstance().requestGlobalMeta()
									.catch(function(err) {
										that.showAlert('Error requesting global metadata: ' + err.message, 'E', err.messageThreadId);
									});
								} else if (!treeRequested) {
									// Update tree if something relevant has changed
									if (Document.containsTreeRelevantChanges(doc)) {
										console.log("Sync: -> Re-requesting tree, document " + (doc.name ? doc.name : doc._id) + " had relevant changes");
									
										TreeActions.getInstance().requestTree()
										.catch(function(err) {
											that.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
										});
									
										treeRequested = true;
									}
								}
							}
						}
					} else {
						that.showProgressBar(1);
					}
				}
			},
		});
	}
	
	/**
	 * Sets the progress bar. Values >= 1 will hide it, lower than zero will show no progress.
	 */
	showProgressBar(percent) {
		if (percent >= 1) {
			$('#progressBar').css('display', 'none');
		} else if (percent < 0) {
			$('#progressBar').css('display', 'none');
		} else {
			var perc = (percent*100).toFixed(2);  
			
			$('#progressBar').css('display', 'block');
			$('#progressBar').css('width', perc + '%');
		} 
	} 

	/**
	 * Can be called to force the service worker to check for updates. 
	 */
	triggerUpdateCheck() {
		navigator.serviceWorker.ready
  		.then( (registration) => {
			if (registration.active) {
				registration.active.postMessage({
					requestId: 'checkUpdates'  
				});
			}
		});	
	}

	/**
	 * Sets the theme color of the PWA
	 */
	setPWAColor(color) {
		var tc = $('#themeColor');
		if (!tc) {
			console.log("Error setting PWA theme color");			
			return;
		}
		tc.attr('content', color);
	}

	/**
	 * Check if the loaded profile is available offline. If not, issue a warning message.	 
	 */
	triggerUnSyncedCheck() {
		var d = Database.getInstance();
		var p = d.profileHandler.getCurrentProfile(); 
		if (p.url && (p.url != 'local') && !p.clone) {
			this.showAlert(
				'Warning: This notebook is not available offline. This may be slow with larger documents.', 
				'W', 
				'UnSyncedMessages',
				false, 
				function(msgElement, event) {
					Notes.getInstance().routing.callSettings();
				}
			);
		}
	}

	/**
	 * Install updates.
	 */
	installUpdates() {
		this.showAlert("Installing, please wait...", "I", "UpdateMessage");  

		if (!navigator.serviceWorker) {
			this.showAlert("No service worker active, try again or just reload the page.", "W", "UpdateMessage"); 
			return;			
		}
		
		navigator.serviceWorker.ready
  		.then( (registration) => {
			if (registration.active) {
				registration.active.postMessage({
					requestId: 'update'
				});
			} else {
				this.showAlert("No service worker active, try again or just reload the page.", "W", "UpdateMessage");
			}
			/*if (registration.waiting) {
				registration.waiting.postMessage(42);  
			}*/
		});			
	} 
	
	/**
	 * Check all sources against the MD5 hashes in this class.
	 *
	checkSources() {
		var promises = [];
		for (var [key, value] of this.sourceHashes) {
			promises.push(
				new Promise(function(resolve) {
					var file = key;
					var hash = value;
					fetch(file)
					.then(function(data) {
						return data.text();
					})
					.then(function(text) {
						var currentHash = md5(text);
						
						if (currentHash != hash) {
							console.log(file + '  ' + currentHash + '  shoud be ' + hash);
						}
						resolve();
					})
				})
			)
		}
		return Promise.all(promises);
	}
	
	/**
	 * Handlers incoming messages from the service worker.
	 */
	setupServiceWorkerMessageReceiver() { 
		navigator.serviceWorker.addEventListener('message', (event) => {
			// Out of date files
			if (event.data.outOfDate) {
				if (Notes.getInstance().outOfDateFiles.length == 0) { 
					setTimeout(function() {
						Notes.getInstance().showAlert(
							"An update is available for this App. Please see the About page in the user menu to install it.", 
							"W", 
							"UpdateMessage", 
							false, 
							function(msgElement, event) {
								Notes.getInstance().routing.callUpdatePage();
							}
						);
					}, 100); 
				}
 
				Notes.getInstance().outOfDateFiles.push(event.data.url);
				
				return;
			}		
			
			// User messages
			if (event.data.requestId) {
				switch(event.data.requestId) {  
					case 'userMessage': {
						var msg = event.data.message ? event.data.message : 'SW Message internal Error: No message transmitted';
						var type = event.data.type ? event.data.type : 'I';
						
						console.log("User message from SW received: Type " + type + ", message: " + msg);
						Notes.getInstance().showAlert(msg, type);
						
						return; 
					}
					case 'unregisterServiceWorker': {
						console.log("Service Worker triggers unregistering...");

						if (!confirm("Reinstall now? No notebook data will get lost.")) {
							Notes.getInstance().showAlert("Action cancelled", 'I', "UpdateMessage");
							return;
						}

						navigator.serviceWorker.ready 
						.then(function(registration) {
							return registration.unregister();
						})
						.then(function(success) {
							Notes.getInstance().showAlert("Wait for the installation to complete...", 'I', "UpdateMessage");
							setTimeout(function() {
								console.log("Reload page for the new SW to be installed");
								location.reload();
							}, 1000); 
						});
						
						return;
					}
				}
			}					
			
			// Update requests
			console.log("Unhandled message from service worker: "); 
			console.log(event.data);	
		});
	}
	
	/**  
	 * Registers the Service Worker.
	 */	
	registerServiceWorker() {
		if ('serviceWorker' in navigator) {
		    navigator.serviceWorker
				.register('ServiceWorker.js')
				.then(function(registration) {
					console.log('ServiceWorker registration successful with scope ' + registration.scope);
					
					// Messages from the service worker
					Notes.getInstance().setupServiceWorkerMessageReceiver();
				}, function(err) {
					console.log('ServiceWorker registration failed: ', err);
					Notes.getInstance().showAlert('ServiceWorker registration failed: ' + err, "E");
			    });
		}
	}
	
	/**
	 * Checks if the notebook contains sheets and displays a warning in this case.
	 * TODO remove when sheets are finally removed in the future.
	 */
	warnSheetsUsed() {
		var that = this;
		
		this.getData().each(function(doc, quit) {
			if (doc.type == 'sheet') {
				that.showAlert('This notebook contains sheets, which will become obsolete soon! Please remove them before updating the app the next time.<br>You can use "type:sheet" to search for sheet documents.', 'W');		
				
				quit();
			}
		});
	}
	
	/**
	 * Disables the back swipe gesture. 
	 * Taken from https://www.outsystems.com/forums/discussion/77514/disable-swipe-to-previous-screen-some-android-and-ios/
	 *
	disableBackSwipe() {
		document.addEventListener('touchstart', function(e) {
			var x = e.touches[0].pageX;
			console.log(x);
			if (x > 10 && x < window.innerWidth - 10) return;
		    e.preventDefault();
		}, { passive: false });
	}
	
	/**
	 * Load the DBs and start the app. This is called before any route and returns a promise,
	 * after which the DB can be used.
	 */
	startApp(profile) {
		var that = this;
		
		// This checks for online connection every two seconds
		if (!this.onlineSensor) {
			this.onlineSensor = new OnlineSensor();
			this.onlineSensor.start(4000, function(data) {
				$('#onlineStatus').css('display', data.onLine ? 'none' : 'inline-block');
			});
		}
		
		// Import DB connection profile from URL
		if (profile) {
			// Import profile from URL
			try {
				var d = Database.getInstance();

				if (d.profileHandler.importProfile(profile)) {
					// Reset databases: We have a new connection profile which has to be set up from scratch
					that.updatedViews = false;
					
					d.reset();
				}
				
			} catch (e) {
				this.showAlert('Error in connection address: ' + e);

				// Set up DOM tree
				this.setupDom();
				
				// Setup header buttons
				this.setButtons(null, true);
				
				// In case of an error loading the profile, we show the profile selection page.
				this.resetPage();
				Profiles.getInstance().load();
				this.update();
				
				return Promise.reject({
					message: 'Error in connection address: ' + e,
					messageThreadId: 'AppStartMessages'
				});
			}
		}
		
		// Set up DOM tree
		this.setupDom();
		
		// Setup header buttons
		this.setButtons(null, true);
		
		// Register service worker, if not already done
		if (!that.serviceWorkerRegistered) {
			that.registerServiceWorker(); 
			that.serviceWorkerRegistered = true;
		}
				
		// Store URL as last loaded address
		ClientState.getInstance().setLastOpenedUrl(location.href);
		
		// Disable back swiping for mobile devices
		/*if (this.isMobile()) {
			this.disableBackSwipe();
		}*/
				
		// Set up a requestTree callback which warns the user if sheets are still used.
		// TODO: Remove when sheets are finally removed completely in the future. 
		Callbacks.getInstance().registerCallback(
			'sheetWarning',
			'requestTree',
			function() {
				that.warnSheetsUsed();
			}
		);
				
		// Initialize database instance with the user ID. This is started asynchronously. After the database(s)
		// is/are up, the settings, notes tree and the last loaded note are requested independently.
		return Database.getInstance().init()
		.then(function(data) {
			// Update views in online mode if necessary (only do this the first time this is called at page load).
			// NOTE: Here we want to keep the chain short because this is always run for all routes,
			//       so we only do this the first time the app launches. In the pull requests during sync,
			//       the views are always checked as there is no hurry there.
			if (!Database.getInstance().profileHandler.getCurrentProfile().clone) {
				if (!that.updatedViews) {
					that.updatedViews = true;

					return Views.getInstance().updateViews()
					.then(function(resp) {
						return Promise.resolve(data);
					});
				}
			}
		
			return Promise.resolve(data);
		})
		.then(function(data) {
			var d = Database.getInstance();

			// The tree and note requests can run in parallel from here on
			// for the most pages. For the others we also return the tree and
			// settings request promises so that following then() handlers can 
			// wait for them if they need to.
			var treePromise = null;
			var settingsPromise = null;
			
			if (data.initialised) {
				settingsPromise = SettingsActions.getInstance().requestSettings()
				.catch(function(err) {
					that.showAlert('Error getting settings: ' + err.message, 'E', err.messageThreadId);
				});
				
				treePromise = TreeActions.getInstance().requestTree()
				.catch(function(err) {
					that.showAlert('Error loading TOC: ' + err.message, 'E', err.messageThreadId);
				});
			}
			
			// Show remote DB status in loaded note display in the header on startup
			d.checkRemoteConnection()
			.then(function(resp) {
				if (!resp.ok) $('#loadedNote').html(resp.status);
			})
			.catch(function(err) {
				$('#loadedNote').html("No remote DB connected");
			});

			return Promise.resolve({
				ok: true,
				treePromise: treePromise,
				settingsPromise, settingsPromise
			});
		})
		.then(function(data) {
			// Load global metadata and the return the app start result from the previous step.
			return MetaActions.getInstance().requestGlobalMeta()
			.then(function() {
				return Promise.resolve(data);				
			})
			.catch(function(err) {
				that.showAlert('Error loading global metadata: ' + err.message, 'E', err.messageThreadId);
				return Promise.resolve(data);
			});
		})
		.catch(function(err) {
			// App start error handling: Show the error and resolve (else the app would be stuck here).
			that.showAlert("Error connecting to database: " + err.message, 'E', err.messageThreadId);
			
			// Here we resolve, because the pages should be loaded nevertheless.
			return Promise.resolve({
				message: "Error connecting to database: " + err.message,
				messageThreadId: err.messageThreadId
			});
		});
	}

	/**
	 * Returns if the current editor is in restore mode.
	 */
	editorInRestoreMode() {
		var e = this.getCurrentEditor();
		if (!e) return false;
		
		if (typeof e.getRestoreMode != 'function') return false;
		
		return e.getRestoreMode();
	}

	/**
	 * Resets the page content elements.
	 */
	resetPage(treePage) {
		var e = this.getCurrentEditor();
		if (e) {
			if (e.isDirty() && (!this.editorInRestoreMode())) {
				var that = this;
				DocumentActions.getInstance().save(e.getCurrentId(), e.getContent())
				.then(function(data) {
	        		if (data.message) that.showAlert(data.message, "S", data.messageThreadId);
	        		e.unload();
	        	})
				.catch(function(err) {
	        		that.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
	        		e.unload();
	        	});
			} else {
				e.unload();	
			}
		}
		AttachmentPreview.getInstance().unload();
		LabelDefinitions.getInstance().unload();
		Versions.getInstance().unload();
		GraphView.getInstance().unload();
		
		this.setCurrentEditor();
		this.setCurrentPage();
		
		this.setMoveSelector();
		this.allowViewportScaling(false);
		this.hideMenu();
		
		$('#contentContainer').empty();
		$('#contentContainer').css('background', '');
		$('#contentContainer').scrollTop(0);
		$('#contentContainer').scrollLeft(0);
		$('#contentContainer').off('contextmenu');
		
		this.setButtons(null, true);
		
		$('#backButton').hide();
		$('#editorNavButtons').hide();
		$('#forwardButton').hide();

		$('#editor').hide();
		$('#console').hide();

		if (treePage) {
			$('#contentContainer').hide();
			$('#treenav').show();

			NoteTree.getInstance().setupFooter();

			if (this.isMobile()) NoteTree.getInstance().refresh();
		} else {
			$('#contentContainer').show();

			this.setupEditorFooter();

			if (this.isMobile()) {
				$('#treenav').hide();
				$('#editorNavButtons').show();
				
				NoteTree.getInstance().initEditorNavButtons();
			}
		}
		
		if (!this.isMobile()) {
			$('#backButton').show();
			$('#forwardButton').show();
		}
		
		this.setFocus(Notes.FOCUS_ID_EDITOR);
		//this.update();
		
		Database.getInstance().setAutoLoginBlock(false);
	}
	
	editorBackButtonHandler(e) {
		e.stopPropagation();
		Notes.getInstance().back();
	}
				
	editorForwardButtonHandler(e) {
		e.stopPropagation();
		Notes.getInstance().forward();
	}
	
	editorHomeButtonHandler(e) {
		e.stopPropagation();
		Notes.getInstance().home();
	}
	
	editorNavButtonHandler(e) {
		e.stopPropagation();
		Notes.getInstance().routing.callProfileRootWithSelectedId(NoteTree.getInstance().getFocussedId());
	}
	
	editorLinkageButtonHandler(e) {
		e.stopPropagation();
		Notes.getInstance().toggleEditorLinkage();
	}
	
	editorCreateButtonHandler(e) {
		e.stopPropagation();
		
		const n = Notes.getInstance();
		const t = NoteTree.getInstance();
		
		//t.block();
		
		DocumentActions.getInstance().create(t.behaviour.getNewItemParent())
		.then(function(data) {
			//t.unblock();
			if (data.message) {
				n.showAlert(data.message, "S", data.messageThreadId);
			}
		})
		.catch(function(err) {
			//t.unblock();
			n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
		});
	}
	
	editorFavoritesButtonHandler(e) {
		e.stopPropagation();
		
		const n = Notes.getInstance();
		var selector = n.getFavoritesSelector('footerFavoritesSelector');
		
		n.showGenericDialog(
			// Init
			function(dialog, e, resolve, reject) {
				dialog.find('.modal-content').append(
					$('<div class="modal-header"><h5 class="modal-title">Open Document from Favorites List:</h5></div>'),
					$('<div class="modal-body"></div>').append(
						selector
						.on('change', function(/*event*/) {
				        	var target = this.value;
					        
							dialog.modal('hide');
							Notes.getInstance().routing.call(target);
						})
					)
				);
				
				selector.selectize({
					sortField: 'text'
				});
				
				// TODO Open selector immediately (seems to be difficult)
			},
			
			// Hide
			function(dialog, e, resolve, reject) {
				resolve();
			},
		);
	}
	
	/**
	 * Delivers a select element containing the favorites and pinned (starred) documents.
	 */
	getFavoritesSelector(elementId) {
		const favs = NoteTree.getInstance().getFavorites();

		var favoritesNum = ClientState.getInstance().getViewSettings().favoritesNum;
		if (!favoritesNum) favoritesNum = Config.defaultFavoritesAmount;
		
		var selector =  $('<select id="' + elementId + '"></select>');
		
		const that = this;
		function addOption(id) {
			selector.append(
				$('<option value="' + id + '">' + that.formatSelectOptionText(id) + '</option>')
			);
		}
		
		for(var i=0; i<favs.starred.length; ++i) {
			addOption(favs.starred[i].id);
		}
		for(var i=0; i<favs.favorites.length && i<favoritesNum; ++i) {
			addOption(favs.favorites[i].id);
		}
		
		return selector;
	}
	
	/**
	 * Generic popup dialog. All callbacks get the same parameters: (dialogElement, event, resolve, reject).
	 */
	showGenericDialog(initCallback, hideCallback) {
		return new Promise(function(resolve, reject) {
			const dialog = $('#genericDialog');
			
			dialog.find('.modal-content').empty();
			
			dialog.off('shown.bs.modal');
			dialog.on('shown.bs.modal', function (event) {
				initCallback(dialog, event, resolve, reject);
			});
			dialog.off('hidden.bs.modal');
			dialog.on('hidden.bs.modal', function (event) {
				hideCallback(dialog, event, resolve, reject);
			});
			
			dialog.modal();
		});
	}
				
	/**
	 * Set up the page DOM tree.
	 */
	setupDom() {
		if (this.isDomSetup) return;
		
		var teaser = $('<div id="teaser"><h4>No note has been loaded</h4><div>Please select a note in the navigation bar or create a new one.</div></div>');
		
		var that = this;
		$('#all').append([
			// Header
			$('<header/>').append([
				$('<div id="progressBar"></div>'),
				
				$('<span id="headerLeft" />').append([
					$('<span id="backButton" data-toggle="tooltip" title="Back" class="fa fa-chevron-left headerButtonLeft headerElementLeft" />')
					.on('click', function(e) {
						e.stopPropagation();
						that.back();
					}),
					
					$('<span id="forwardButton" data-toggle="tooltip" title="Forward" class="fa fa-chevron-right headerButtonLeft headerElementLeft" />')
					.on('click', function(e) {
						e.stopPropagation();
						that.forward();
					}),
					
					$('<span id="syncStatus" />').append([
						$('<span onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();" data-toggle="tooltip" title="Synchronizing to remote database..." class="fa fa-sync headerButtonLeft headerElementLeft" id="syncStatusSyncing"/>'),
						$('<span onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();" data-toggle="tooltip" title="Sync Status: OK" class="fa fa-check headerButtonLeft headerElementLeft" id="syncStatusOk" />'),
						$('<span onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();" data-toggle="tooltip" title="Sync Status: Out of sync" class="fa fa-bolt headerButtonLeft headerElementLeft" id="syncStatusDirty" />'),
						$('<span onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();" data-toggle="tooltip" title="Sync Status: Unknown" class="fa fa-question headerButtonLeft headerElementLeft" id="syncStatusUnknown" />'),
						$('<span onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();" data-toggle="tooltip" title="Sync Status: Paused" class="fa fa-pause headerButtonLeft headerElementLeft" id="syncStatusPaused" />'),
					]),

					$('<span id="onlineStatusContainer" />').append([
						$('<span data-toggle="tooltip" title="Offline" class="fa fa-plane headerElementLeft" id="onlineStatus"/>'),
					]),
					
					$('<span id="headerMoveSelectorContainer" />'),

					$('<span id="headerText"></span>').append([
						$('<span id="loadedNote"></span>'),
						$('<span id="changedMarker" style="display: none;"> *</span>')
					])
				]),
				$('<span id="headerRight" />')
			])
			.contextmenu(function(e) {
				e.stopPropagation();
				e.preventDefault();

				// Show user menu
				that.showUserMenu();
			}),
			/*.on('dblclick', function(e) {
				e.stopPropagation();

				// Refresh on header click
				if (!confirm('Reload app?')) return;
				location.reload();
			}),*/
			
			// Content
			$('<section>').append([
				// Navigation (grid)
				$('<nav id="treenav"></nav>'),
				
				// Main content
				$('<article id="article"></article>').append([
					
					// Content container, used by most of the pages
					$('<div id="contentContainer" class="mainPanel"/>').append(teaser),
					
					// Note Editor (for TinyMCE this is needed separately)
					Editor.getInstance().getContainerDom(teaser),
					
					// Console
					$('<div id="console" class="mainPanel"/>'),
					
					// Buttons for editor (left side)
					this.useFooter() ? null : $('<div id="editorNavButtons" class="editorNavButtons"/>')
					.append(
						// Back button used to navigate back to the tree in mobile mode
						$('<div id="backButton2" class="editorNavButton roundedButton fa fa-arrow-left"></div>')
						.on('click', this.editorBackButtonHandler),
						
						// Forward button used to navigate back to the tree in mobile mode
						$('<div id="forwardButton2" class="editorNavButton roundedButton fa fa-arrow-right"></div>')
						.on('click', this.editorForwardButtonHandler),

						// Home button used to navigate back to the tree root in mobile mode
						$('<div id="homeButton2" class="editorNavButton roundedButton fa fa-home"></div>')
						.on('click', this.editorHomeButtonHandler)
					),
					
					// Buttons for editor (right side)
					this.useFooter() ? null : $('<div id="editorLinkButtons" data-toggle="tooltip" title="" class="editorLinkButtons"/>')
					.append(
						// Link page button
						$('<div id="linkEditorButton" class="editorLinkButton roundedButton fa fa-link"></div>')
						.on('click', this.editorLinkageButtonHandler),
					)
				])
				.on('click', function(event) {
					that.setFocus(Notes.FOCUS_ID_EDITOR);
				})
			]),
			
			$('<div id="footer"></div>')
		]);

		// Also setup the navigation tree
		NoteTree.getInstance().setupDom();
	
		// Setup the generically reused option buttons
		ContextMenu.setupItemOptions(this.optionsMasterContainer);
		
		// We only do this once ;)
		this.isDomSetup = true;
	}
	
	/**
	 * Sets up the footer for editors on mobile.
	 */
	setupEditorFooter() {
		if (this.useFooter()) {
			this.setFooterContent([
				// Back button used to navigate back to the tree in mobile mode
				$('<div id="backButton2" class="footerButton fa fa-chevron-left"></div>')
				.on('click', this.editorBackButtonHandler),
				
				// Forward button used to navigate back to the tree in mobile mode
				$('<div id="forwardButton2" class="footerButton fa fa-chevron-right"></div>')
				.on('click', this.editorForwardButtonHandler),

				// Home button used to navigate back to the tree root in mobile mode
				$('<div id="homeButton2" class="footerButton fa fa-map"></div>')
				.on('click', this.editorNavButtonHandler),

				// Create note
				$('<div id="createButton2" class="footerButton fa fa-plus"></div>')
				.on('click', this.editorCreateButtonHandler),

				// Favorites
				$('<div id="favsButton2" class="footerButton fa fa-star"></div>')
				.on('click', this.editorFavoritesButtonHandler),

				// Link page button
				//$('<div id="linkEditorButton" class="footerButton fa fa-link"></div>')
				//.on('click', this.editorLinkageButtonHandler),
			]);
		} else {
			this.setFooterContent();
		}
	}
	
	/**
	 * Toggle linkage from navigation to editor 
	 */
	toggleEditorLinkage() {
		var linkEditorMode = ClientState.getInstance().getLinkageMode('editor');
		
		linkEditorMode = this.isMobile() ? 'off' : ((linkEditorMode == 'on') ? 'off' : 'on');
		
		ClientState.getInstance().setLinkageMode('editor', linkEditorMode);
		
		this.updateLinkageButtons();
		
		this.setFocus(Notes.FOCUS_ID_EDITOR);
	}

	/**
	 * Restore linkage settings for the editor button.
	 */	
	restoreEditorLinkage() {
		/*if ((!this.isMobile()) && NoteTree.getInstance().supportsLinkEditorToNavigation()) {
			var linkEditorMode = ClientState.getInstance().getLinkageMode('editor');
			if (linkEditorMode) {
				this.linkEditorToNavigation = linkEditorMode;
			}
		} else {
			this.linkEditorToNavigation = 'off';
		}*/
		
		this.updateLinkageButtons();
	}
	
	/**
	 * Update the linkage button's appearance.
	 */
	updateLinkageButtons() {
		var t = NoteTree.getInstance();
		
		var page = this.getCurrentPage();
		var pageSupport = (!!this.getCurrentEditor()) || (page && 
		       (typeof page.supportsLinkageFromNavigation == 'function') && 
		       page.supportsLinkageFromNavigation()
		);
		
		var linkEditorMode = ClientState.getInstance().getLinkageMode('editor');
		
		$('#linkEditorButton').css('display', (this.isMobile() || (!t.supportsLinkEditorToNavigation()) || (!pageSupport)) ? 'none' : 'block');
		$('#linkEditorButton').css('background-color', (linkEditorMode == 'on') ? '#c40cf7' : '#ffffff');
		$('#linkEditorButton').css('color', (linkEditorMode == 'on') ? '#ffffff' : '#000000');
		$('#linkEditorButton').attr('title', (linkEditorMode == 'on') ? 'Unlink editor from navigation' : 'Link editor to navigation');
	}
	
	static FOCUS_ID_EDITOR = 'editor';
	static FOCUS_ID_NAVIGATION = 'nav';

	focusId = Notes.FOCUS_ID_EDITOR;

	/**
	 * Returns the current focus ID.
	 */
	getFocusId() {
		// Check if the page provides an override for focussing
		var page = this.getCurrentPage();
		if (page && (typeof page.overrideFocusId == 'function')) {
			return page.overrideFocusId();
		}
		
		return this.focusId;
	}
	
	/**
	 * Set ID of focussed area.
	 */
	setFocus(id) {
		this.focusId = id;

		this.update();
	}
	
	/**
	 * Go home to the navigation root
	 */
	home() {
		NoteTree.getInstance().resetScrollPosition('all');
		NoteTree.getInstance().focus("");
		this.routing.call();
	}
		
	browserBack() {
		ClientState.getInstance().setLastOpenedUrl();
		history.back();
	}
	
	/**
	 * Go back in browser history
	 */
	back() {
		if (this.isMobile()) {
			this.browserBack();
		} else {
			if (this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) {
				NoteTree.getInstance().appBackButtonPushed();
			} else {
				// Editor focussed
				this.browserBack();
			}
		}
	}
	
	browserForward() {
		ClientState.getInstance().setLastOpenedUrl();
		history.forward();
	}
		
	/**
	 * Go forward in browser history
	 */
	forward() {
		if (this.isMobile()) {
			this.browserForward();
		} else {
			if (this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) {
				NoteTree.getInstance().appForwardButtonPushed();
			} else {
				// Editor focussed
				this.browserForward();
			}
		}
	}
	
	/**
	 * Updates the "enabled" state of the navigation buttons.
	 */
	updateHistoryButtons() {
		const backButt = $('#backButton');
		const forwardButt = $('#forwardButton');
		
		backButt.css('color', '');
		forwardButt.css('color', '');

		if (this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) {
			const history = NoteTree.getInstance().getHistory();
			
			if (history) {
				const deactivatedColor = Tools.blendColors(0.2, this.getMainColor(), this.getTextColor());
				
				backButt.css('color', (NoteTree.getInstance().historyCanBack() ? '' : deactivatedColor));
				forwardButt.css('color', (history.canForward() ? '' : deactivatedColor));
			}
		}
	}
	
	/**
	 * Returns the current editor.
	 */
	getCurrentEditor() {
		return this.currentEditor;
	}
	
	/**
	 * Sets the current editor.
	 */
	setCurrentEditor(e) {
		this.currentEditor = e ? e : null;
	}
	
	/**
	 * Returns the current page instance, if any (editors included).
	 */
	getCurrentPage() {
		return this.currentPage ? this.currentPage : null;
	}
	
	/**
	 * Sets the passed page instance as current one.
	 */
	setCurrentPage(inst) {
		this.currentPage = inst;
	}

	/**
	 * Called by anyone who wants to tell the online sensor that it should 
	 * check better next time. Normally, the sensor does not do test requests
	 * to preserve bandwidth.
	 */
	notifyOfflineState() {
		if (!this.onlineSensor) return;
		this.onlineSensor.checkNextTime();
	}
	
	/**
	 * Re-trigger the current location / refresh routing.
	 */
	refresh() {
		NoteTree.getInstance().refresh();
		this.routing.refresh();
	}
	
	/**
	 * Updates the sync status icon below the tree, according to the database sync status.
	 */
	updateSyncStatus() {
		var state = Database.getInstance().syncHandler.syncState;
		if (!state || state == "") {
			if (Database.getInstance().profileHandler.getCurrentProfile().clone) {
				state = "unknown";
			} else {
				state = "offline";
			}
		}
		
		var showOk = false;
		var showSyncing = false;
		var showDirty = false;
		var showUnknown = false;
		var showPaused = false;
		
		switch(state) {
		case "ok":
			showOk = true;
			break;
		case "syncing":
			showSyncing = true;
			break;
		case "dirty":
			showDirty = true;
			break;
		case "unknown":
			showUnknown = true;
			break;
		case "paused":
			showPaused = true;
			break;
		}
		
		$('#syncStatusOk').css('display', showOk ? 'inline-block' : 'none');
		$('#syncStatusSyncing').css('display', showSyncing ? 'inline-block' : 'none');
		$('#syncStatusDirty').css('display', showDirty ? 'inline-block' : 'none');
		$('#syncStatusUnknown').css('display', showUnknown ? 'inline-block' : 'none');
		$('#syncStatusPaused').css('display', showPaused ? 'inline-block' : 'none');
	}
		
	/**
	 * Returns if the menu with the passed ID is visible.
	 */
	isMenuVisible(menuId) {
		return this.menuId == menuId;
	}
	
	/**
	 * Hides all menus.
	 */
	hideMenu() {
		$(document).off('click', this.hideMenuHandler);
		
		$('#userMenuContainer').empty();
		this.menuId = false;
	}
	
	/**
	 * Wrapper of hideMenu for use as event handler
	 */
	hideMenuHandler() {
		Notes.getInstance().hideMenu();
	}

	/**
	 * Shows a menu. If the same options are already shown, it hides the menu again.
	 */
	showMenu(menuId, callback) {
		if (this.isMenuVisible(menuId)) {
			this.hideMenu();
			return;
		}

		$('#userMenuContainer').empty();
		$('#userMenuContainer').append(
			$('<div id="userMenu" class="userbuttons"></div>')
		)
		
		callback($('#userMenu'));
		
		this.menuId = menuId;
		this.update(true);
		
		$(document).on('click', this.hideMenuHandler);
	}
	
	/**
	 * Returns what the notebook should be shown to be named like.
	 */
	getCurrentNotebookVisibleName() {
		const s = Settings.getInstance().settings;
		const p = Database.getInstance().profileHandler;
		
		return (s.dbAccountName ? s.dbAccountName : ProfileHandler.extractDatabaseName(p.getCurrentProfile().url));
	}
	
	/**
	 * Shows the user main menu.
	 */
	showUserMenu() {
		this.hideOptions();
		
		var that = this;
		this.showMenu('user', function(cont) {
			cont.append([
				$('<div class="userbuttonPassive"><div class="fa fa-user userbuttonIcon"></div>' + that.getCurrentNotebookVisibleName() + '</div>'),
				$('<div class="userbuttonLine"></div>'),

				$('<div class="userbutton" id="selProfileMenuItem" onclick="event.stopPropagation();Notes.getInstance().routing.callSelectProfile()"><div class="fa fa-home userbuttonIcon"></div>Select Notebook</div>'),
				
				!ClientState.getInstance().experimentalFunctionEnabled(GraphView.experimentalFunctionId) ? null :
				$('<div class="userbutton" id="graphMenuItem" onclick="event.stopPropagation();Notes.getInstance().routing.callGraphView()"><div class="fa fa-project-diagram userbuttonIcon"></div>Graph</div>'),
				
				$('<div class="userbutton" id="conflictsMenuItem" onclick="event.stopPropagation();Notes.getInstance().routing.callConflicts()"><div class="fa fa-bell userbuttonIcon"></div>Conflicts</div>'),
				$('<div class="userbuttonLine"></div>'),
				
				$('<div class="userbutton" id="syncMenuButton" onclick="event.stopPropagation();Database.getInstance().syncHandler.syncManually();"><div class="fa fa-sync userbuttonIcon"></div>Synchronize</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().routing.callSettings()"><div class="fa fa-cog userbuttonIcon"></div>Settings</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().routing.callHashtags()"><div class="fa fa-hashtag userbuttonIcon"></div>All Hashtags</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().routing.callLabelDefinitions()"><div class="fa fa-tags userbuttonIcon"></div>All Labels</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().routing.callConsole()"><div class="fa fa-terminal userbuttonIcon"></div>Console</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().routing.callTrash()"><div class="fa fa-trash userbuttonIcon"></div>Trash</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().hideMenu();setTimeout(function(){Notes.getInstance().routing.callDocumentation()},100)"><div class="fa fa-question userbuttonIcon"></div>Help</div>'),
				//$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().hideMenu();setTimeout(function(){Notes.getInstance().routing.callUpdatePage()},100)"><div class="fa fa-heart userbuttonIcon"></div>Update</div>'),
				$('<div class="userbutton" onclick="event.stopPropagation();Notes.getInstance().hideMenu();setTimeout(function(){Notes.getInstance().routing.callAbout()},100)"><div class="fa fa-info userbuttonIcon"></div>About...</div>'),
			]);
			 
			$('#syncMenuButton').css('display', Database.getInstance().profileHandler.getCurrentProfile().clone ? 'block' : 'none');
		});
	}
	
	/**
	 * Adjusts the size of all rounded buttons.
	 */
	setRoundedButtonSize(size, cssClass) {
		if (!cssClass) cssClass = '.roundedButton';
		size = parseFloat(size);
		var el = $(cssClass);
		
		el.css('font-size', size + "px");
		el.css('padding-top', size/2 + "px");
		el.css('padding-bottom', size/2 + "px");
		el.css('width', size*2 + "px");
		el.css('height', size*2 + "px");
	}
	
	getRoundedButtonSize() {
		var g = ClientState.getInstance().getLocalSettings();
		if (g) {
			if (this.isMobile()) {
				if (g.optionTextSizeMobile) {
					return parseFloat(g.optionTextSizeMobile);
				}
			} else {
				if (g.optionTextSizeDesktop) {
					return parseFloat(g.optionTextSizeDesktop);
				}
			}
		}
		
		// Default
		return this.isMobile() ? Config.defaultButtonSizeMobile : Config.defaultButtonSizeDesktop;
	}
	
	/**
	 * Sets the CSS for header buttons on the passed jquery element(s). size has to be the header size (see getHeaderSize()).
	 * Returns the element(s) for daisy chaining.
	 */
	setHeaderButtonSize(el, size, noMinWidth, paddingFactor) {
		if (!paddingFactor) paddingFactor = (10/55);
		el.css('font-size', size * (32/55) + 'px');
		el.css('padding', (size * paddingFactor) + 'px');
		if (noMinWidth != true) el.css('min-width', size + 'px');
		return el;
	}

	/**
	 * Returns the header size.
	 */
	getHeaderSize() {
		var g = ClientState.getInstance().getLocalSettings();
		if (g) {
			if (this.isMobile()) {
				if (g.headerSizeMobile) {
					return parseFloat(g.headerSizeMobile);
				}
			} else {
				if (g.headerSizeDesktop) {
					return parseFloat(g.headerSizeDesktop);
				}
			}
		}
		
		// Default
		return this.isMobile() ? Config.defaultHeaderSizeMobile : Config.defaultHeaderSizeDesktop;
	}
	
	/**
	 * Returns the footer size.
	 */
	getFooterSize() {
		var g = ClientState.getInstance().getLocalSettings();
		if (this.isMobile() && g && g.footerSizeMobile) {
			return parseFloat(g.footerSizeMobile);
		}
		
		// Default
		return this.isMobile() ? Config.defaultFooterSizeMobile : 0;
	}
	
	/**
	 * Adds the passed element(s) to the footer after clearing it. elements may be an element or a list of elements.
	 */
	setFooterContent(elements) {
		$('#footer').empty();
		if (elements) $('#footer').append(elements);
	}
	
	/**
	 * Use a footer?
	 */
	useFooter() {
		return this.isMobile();
	}
	
	/**
	 * Update the header CSS to its defined size.
	 */
	updateDimensions() {
		var size = this.getHeaderSize();
		var fsize = this.getFooterSize();
		
		// Common containers: All content
		$('#all').css('height', $(window).height() + 'px');
		
		// Content area (Editors and nav)
		$('section').css('top', size + 'px');
		$('section').css('height', ($(window).height() - size - fsize) + 'px');
		$('section').css('flex-direction', this.isMobile() ? 'column' : 'row');

		// Navigation area
		$('nav').css('height', ($(window).height() - size - fsize) + 'px');
		$('nav').css('min-height', ($(window).height() - size - fsize) + 'px');
		$('nav').css('max-height', ($(window).height() - size - fsize) + 'px');
		
		$('nav').css('flex', this.isMobile() ? 2 : 'none');
		$('nav').css('height', this.isMobile() ? '100%' : '');
		$('nav').css('resize', this.isMobile() ? '' : 'horizontal');
		
		// Footer
		$('#footer').css('display', (this.useFooter() ? 'grid' : 'none'));
		if (this.useFooter()) {
			$('#footer').css('height', fsize + 'px');
			$('#footer').css('font-size', Math.max(fsize / 3, 20) + 'px');
		}
		
		// Header
		$('header').css('height', size + 'px');
		
		// Left header
		this.setHeaderButtonSize($('.headerElementLeft'), size);
		
		$('#headerText').css('font-size', size * (20/55) + 'px');
		$('#headerText').css('padding-top', size * (12/55) + 'px');

		$('#headerMoveSelectorContainer').css('font-size', size * (20/55) + 'px');
		$('#headerMoveSelectorContainer').css('padding-top', size * (12/55) + 'px');
		
		// Right header
		this.setHeaderButtonSize($('.headerButton'), size);
		
		$('.alertHeaderNotification').css('top', size * (6/55) + 'px');
		$('.alertHeaderNotification').css('right', size * (6/55) + 'px');
		
		// User menu
		$('.userbuttons').css('top', size + 'px');
		
		// Alert notification icon at user menu icon
		this.setRoundedButtonSize(size * (8 / 55), '.alertNotification');
		
		// Option icons
		this.setRoundedButtonSize(this.getRoundedButtonSize());
	}
	
	/**
	 * Sets the main theme color 
	 */
	setMainColor(color) {
		if (!color) return;
		this.setPWAColor(color);
		$('header').css('background-color', color);
		$('.headerMoveSelector').css('background-color', color);
	}
	
	/**
	 * Sets the text and logo color 
	 */
	setTextColor(color) {
		if (!color) return;
		$('header').css('color', color);
		$('.headerMoveSelector').css('color', color);
		$('#progressBar').css('background-color', color);
	}
	
	/**
	 * Sets a text in the status line at the top
	 */
	setStatusText(txt, clickCallback) {
		if (!txt) txt = '';
		$('#loadedNote').html(txt);
		$('#loadedNote').off('click');

		if (clickCallback) {
			$('#loadedNote').on('click', function(event) {
				clickCallback(event);
			});
			$('#loadedNote').css('cursor', 'pointer');
		} else {
			$('#loadedNote').css('cursor', 'auto');
		}
	}
	
	/**
	 * Shows the move target selector for the given ID, or hides it if id is falsy.
	 */
	setMoveSelector(id) {
		if (!this.getData()) return;
		
		if (!id) { 
			$('#headerMoveSelectorContainer').empty();
			this.currentMoveTargetId = false;
			return;
		}
		
		var doc = this.getData().getById(id);
		if (!doc) return null;

		if (this.currentMoveTargetId == id) return;

		$('#headerMoveSelectorContainer').empty();

		var selector = this.getMoveTargetSelector([id]);
		selector.val(doc.parent);
		selector.addClass('headerMoveSelector');
		
		var that = this;
		$('#headerMoveSelectorContainer').append(
			selector
			.on('change', function(/*event*/) {
	        	var target = this.value;
	        	
	        	Tools.adjustSelectWidthToValue($(this));
	        	$(this).blur();
	        	
	        	DocumentActions.getInstance().moveDocuments([id], target, true)
	        	.then(function(data) {
	        		var doc = Notes.getInstance().getData().getById(id);
	        		var tdoc = Notes.getInstance().getData().getById(target);
	        		
	        		Notes.getInstance().showAlert('Moved ' + doc.name + ' to ' + (tdoc ? tdoc.name : Config.ROOT_NAME), 'S', data.messageThreadId);
	        	})
	        	.catch(function(err) {
	        		that.showAlert("Error moving document: " + err.message, 'E', err.messageThreadId);
	        	});
			})
		);
		
		Tools.adjustSelectWidthToValue(selector);
		
		this.setMainColor($('header').css('background-color'));
		this.setTextColor($('header').css('color'));
		
		this.currentMoveTargetId = id;
	}

	/**
	 * Generates and returns a select element containing elements for all available move targets.
	 * excludeIds will be excluded from the selection, as well as all children of these.
	 */
	getMoveTargetSelector(excludeIds, excludeRoot) {
		var selector = $('<select></select>');
		
		var ids = excludeRoot ? [] : [{
			text: Config.ROOT_NAME + ' /',
			id: ''
		}];

		var that = this;
		this.getData().each(function(d) {
			for(var e in excludeIds || []) {
				if (that.getData().isChildOf(d._id, excludeIds[e])) return;
			}
			
			ids.push({
				text: that.getData().getReadablePath(d._id),
				id: d._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + this.formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		
		return selector;
	}
	
	/**
	 * Returns a selector element containing all image attachments available
	 */
	getBackgroundImageSelector() {
		var selector = $('<select></select>');
		
		var ids = [];

		var that = this;
		this.getData().each(function(d) {
			if (!Document.isImage(d)) return;
			
			ids.push({
				text: that.getData().getReadablePath(d._id),
				id: d._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		selector.append(
			$('<option value="_cancel" selected>No Image</option>')
		);

		//for(var i=0; i<ids.length; ++i) {
		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + this.formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		
		return selector;
	}
	
	/**
	 * Formatting of all select options texts.
	 */
	formatSelectOptionText(text) {
		if (!text) return text;
		if (this.isMobile() && (text.length > Config.MOBILE_MAX_SELECTOPTION_LENGTH)) {
			return '...' + text.substring(text.length - Config.MOBILE_MAX_SELECTOPTION_LENGTH);
		}
		return text;
	}
	
	/**
	 * Sets the passed array of buttons (must be DOM elements).
	 */
	setButtons(arr, noUpdate) {
		$('#headerRight').empty();
		
		// We set the header size for the buttons in advance to prevent flickering.
		var size = this.getHeaderSize();
		
		// Add custom buttons.
		for(var i in arr || []) {
			if (!arr[i]) continue;
			
			$('#headerRight').append(
				this.setHeaderButtonSize(arr[i].addClass("headerButton"), size)
			);
		}
		
		// Add standard buttons and alert notification.
		$('#headerRight').append(
			this.setHeaderButtonSize($('<div type="button" data-toggle="tooltip" title="User Menu" class="fa fa-user headerButton" id="userMenuButton" onclick="event.stopPropagation();Notes.getInstance().showUserMenu();"></div>'), size),
			this.setHeaderButtonSize($('<div class="alertHeaderNotification alertNotification conflictMarker fa fa-bell"></div>'), size, true, 0.04),
		);
		
		// Update UI
		if (!noUpdate) this.update();
		//else this.updateDimensions();
	}
	
	/**
	 * Shows or hides the changed marker.
	 */
	setChangeMarker(visible) {
		$('#changedMarker').css("display", visible ? "inline" : "none");
	}
	
	getTextColor() {
		return $('header').css('color');
	}

	getMainColor() {
		return $('header').css('background-color');
	}
	
	/**
	 * Update states of objects
	 */
	update(dontHideUserMenu) {
		// Changed marker visibility
		var e = this.getCurrentEditor();
		this.setChangeMarker(e ? e.isDirty() : false);
		
		// Hide user menu
		if (!dontHideUserMenu) this.hideMenu();

		this.hideOptions();

		// Focus
		if (this.isMobile()) {
			$('#treenav').css('border', 'none');
			$('#article').css('border', 'none');
		} else {
			$('#treenav').css('border-bottom', ((this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) ? ('3px solid ' + Config.focusColor) : '3px solid darkgrey'));
			$('#article').css('border-bottom', ((this.getFocusId() == Notes.FOCUS_ID_EDITOR) ? ('3px solid ' + Config.focusColor) : '3px solid darkgrey'));
		}

		// Update tree (hide options and update selected item to match the editor)
		var t = NoteTree.getInstance();
		t.updateSelectedState();
		t.setTreeTextSize(t.getTreeTextSize());
		
		this.updateSyncStatus();
		
		// Adjust height for large trees
		$('section').css('min-height', $('#treecontainer').outerHeight() + 20);
		
		// Update move target selector if there is an active editor and the currently shown selector is out of date
		this.setMoveSelector(this.getCurrentlyShownId(true));

		// For small screens, the left header display also needs to be restricted (causing an ellipsis there possibly)
		if ($('#headerLeft').offset()) {
			$('#headerLeft').width('');
			$('.headerMoveSelector').css('max-width', '');
			var loadedNoteRightX = $('#headerLeft').offset().left + $('#headerLeft').width();
			var buttonsTopLeftX = $('#headerRight').offset().left;
			
			var diff = loadedNoteRightX - buttonsTopLeftX + 10
			if (diff > 0) {
				$('#headerLeft').width($('#headerLeft').width() - diff);
				$('.headerMoveSelector').css('max-width', $('#headerLeft').width() / 2);
			}
		}
		
		// Align back button 2 (for content panel): Positioning with pure CSS seems not possible here.
		var contentHeight = $('#article').height();
		$('#editorNavButtons').css('top', (contentHeight - 20 - $('#editorNavButtons').outerHeight(true)) + "px");
		$('#editorLinkButtons').css('top', (contentHeight - 20 - $('#editorNavButtons').outerHeight(true)) + "px");
		
		// Conflict alert icons
		$('.conflictMarker').css('display', (this.getData() && this.getData().hasConflicts()) ? 'inline-block' : 'none');

		// Update header size
		this.updateDimensions();
		
		// Update button states
		this.updateLinkageButtons();
		this.updateHistoryButtons();
	}
	
	/**
	 * Adds the document to the favorites list, or if already there, increases its call count.
	 */
	addFavorite(doc) {
		if (!doc) return;
		
		var favorites = ClientState.getInstance().getFavorites();
		var hash = Tools.hashCode(doc._id);
		
		if (!favorites["doc" + hash]) {
			favorites["doc" + hash] = {
				id: doc._id,
				rank: 1
			}
		} else {
			favorites["doc" + hash].rank ++;
		}
		
		ClientState.getInstance().saveFavorites(favorites);
		
		NoteTree.getInstance().updateFavorites();
	}
	
	/**
	 * Remove favorites entry for given document ID.
	 */
	removeFavorite(id) {
		if (!id) return;
		
		var favorites = ClientState.getInstance().getFavorites();
		var hash = Tools.hashCode(id);
		
		if (!favorites["doc" + hash]) return;

		favorites["doc" + hash] = false;
		
		ClientState.getInstance().saveFavorites(favorites);
		
		NoteTree.getInstance().updateFavorites();
	}
	
	/**
	 * Clear local favorites.
	 */
	clearFavorites() {
		if (!confirm('Clear favorites for this notebook?')) {
			this.showAlert('Action cancelled.', 'I');
			return;
		}
		
		ClientState.getInstance().saveFavorites({});
		
		NoteTree.getInstance().updateFavorites();
	}
	
	/**
	 * Tries to determine the document currently shown.
	 */
	getCurrentlyShownId(editorsOnly) {
		var e = this.getCurrentEditor();
		if (e) return e.getCurrentId();
		
		var attId = AttachmentPreview.getInstance().current ? AttachmentPreview.getInstance().current._id : false;
		if (attId) return attId;
		
		if (!editorsOnly) {
			var versId = Versions.getInstance().currentId;
			if (versId) return versId;
			
			var labelsId = LabelDefinitions.getInstance().current ? LabelDefinitions.getInstance().current._id : false;
			if (labelsId) return labelsId;
		}
		
		return false;
	}

	/**
	 * If there is an editor opened, reload it from database.
	 */	
	reloadCurrentEditor() {
		var e = this.getCurrentEditor();
		if (!e) return Promise.resolve();
		
		var current = e.getCurrentId();
		if (!current) return Promise.resolve();
	
		var that = this;
		return DocumentAccess.getInstance().loadDocumentsById([current])
		.then(function(data) {
			e.load(that.getData().getById(current));
			return Promise.resolve();
		});
	}
	
	/**
	 * Returns if we are on a small mobile device.
	 */
	isMobile() {
		var mode = ClientState.getInstance().getMobileOverride();
		if (mode) {
			if (mode == "mobile") return true;
			if (mode == "desktop") return false;
		}
		
		const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
		return vw <= 800;
	}
	
	/**
	 * Alerting. If you pass a thread ID, all older messages with the same ID will be removed first.
	 * Default type is "E". alwaysHideAtNewMessage can be used if you like to have the message disappearing whenever a new one comes in.
	 * callbackFunction is optional and executed on clicking the message.
	 */
	showAlert(msg, type, threadID, alwaysHideAtNewMessage, callbackFunction) {
		if (!type) type = 'E';
		
		Console.log('Message type ' + type + ': ' + msg, type);
		
		var msgEl = $('<div class="singleMessageContainer">' + msg + '</div>');
		var msgCont = $('<tr></tr>').append($('<td class="singleMessageContainerTd"></td>').append(msgEl));
		var fadeTime = 0;
		
		switch (type) {
		case 'E':
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_ERROR_FADEOUT_AFTER_MS;
			break;
		case 'W':
			msgEl.addClass("btn btn-warning");
			fadeTime = Config.MESSAGE_WARNING_FADEOUT_AFTER_MS;
			break;
		case 'S':
			msgEl.addClass("btn btn-success");
			fadeTime = Config.MESSAGE_SUCCESS_FADEOUT_AFTER_MS;			
			break;
		case 'I':
			msgEl.addClass("btn btn-info");
			fadeTime = Config.MESSAGE_INFO_FADEOUT_AFTER_MS;
			break;
		default:
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_OTHERS_FADEOUT_AFTER_MS; 
			break;
		}

		// Click to remove
		msgEl.click(function(event) {
			event.stopPropagation(); 
			msgCont.remove();
			
			if (callbackFunction) {
				callbackFunction(msgCont, event);
			}
		});	

		// Add message at the top
		$('#messages').prepend(msgCont);

		// Fade out after a certain time
		if (fadeTime > 0) { 
			msgCont.msgTimeoutHandle = setTimeout(function() {
				if (msgCont && msgCont.fadeOut) msgCont.fadeOut();
			}, fadeTime);
		}
		
		// Hide messages of the same thread
		if (threadID) {
			$('#messages').children().each(function(el) {
				var tid = $(this).data("threadID");
				if (tid == threadID) {
					$(this).remove();
				}
			});
			
			msgCont.data("threadID", threadID);
		}
		
		// Hide messages which are not important
		$('#messages').children().each(function(el) {
			var flag = $(this).data("alwaysHideAtNewMessage");
			if (flag) {
				$(this).remove();
			}
		});
		if (alwaysHideAtNewMessage) {
			msgCont.data("alwaysHideAtNewMessage", true);
		}
	}
	
	/**
	 * Defines if the viewport allows scaling, depending whether allow is truely or falsy. 
	 */
	allowViewportScaling(allow) {
		var viewport = document.querySelector("meta[name=viewport]");
		if (allow) {
			viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
		} else {
			viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0');
		}
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Calls the options dialog at the given place.
	 */
	callOptions(ids, pageX, pageY, options) {
		if (!options) {
			options = {
				showInNavigation: false,      // Show in Navigation (default: hidden)
				noCreate: false,
				noRename: false,
				noMove: false,                // Hide move option
				noCopy: false,                // Hide copy option
				noDelete: false,              // Hide delete option
				noBgColor: false,
				noColor: false,
				noLabels: false,
				noBgImage: false,
				showDeleteFavorite: false,
				showClearFavorites: false,
				//showStarToggle: true,
			};
		}
		
		this.hideOptions();
		if (!ids.length) return;
		
		this.optionsIds = Tools.removeDuplicates(ids);
		this.optionOptions = options;
		
		var x = (this.isMobile() ? pageX - $('#treebuttons').width() : pageX) + Config.CONTEXT_OPTIONS_XOFFSET;
		if (x < 0) x = 0;
		
		var y = pageY + Config.CONTEXT_OPTIONS_YOFFSET;
		
		$('#treebuttons').css({
			display: "block",
			left: x,
			top: y
		});
		
		this.updateOptionStyles();
		
		// Add global removal handler
		$(document).on('click', this.hideOptionsHandler);
	}
	
	/**
	 * Updates the options styles.
	 */
	updateOptionStyles() {
		var options = this.optionOptions;
		
		if (!this.optionsIds) return;
		
		// Select the available options for single or multiple selection
		$('.contextOptionSingle').css('display', (this.optionsIds.length == 1) ? 'inline-block' : 'none');
		
		if (this.optionsIds.length <= 1) {
			// Options for a single document
			var doc = this.getData().getById(this.optionsIds[0]);
	
			// Options: Show in Navigation (default: hidden)
			$('.contextOptionRename').css('display', options.noRename ? 'none' : 'inline-block');
			$('.contextOptionShowInNavigation').css('display', options.showInNavigation ? 'inline-block' : 'none');
			$('.contextOptionMove').css('display', options.noMove ? 'none' : 'inline-block');
			$('.contextOptionCopy').css('display', options.noCopy ? 'none' : 'inline-block');
			$('.contextOptionDelete').css('display', options.noDelete ? 'none' : 'inline-block');
			$('.contextOptionLabels').css('display', options.noLabels ? 'none' : 'inline-block');
			$('.contextOptionColor').css('display', options.noColor ? 'none' : 'inline-block');
			$('.contextOptionBgColor').css('display', options.noBgColor ? 'none' : 'inline-block');
			$('.contextOptionDeleteFavorite').css('display', options.showDeleteFavorite ? 'inline-block' : 'none');
			$('.contextOptionClearFavorites').css('display', options.showClearFavorites ? 'inline-block' : 'none');
			$('.contextOptionBgImage').css('display', options.noBgImage ? 'none' : 'inline-block');
	
			// Show special options for references
			var isref = (doc && (doc.type == 'reference'));
				
			$('.contextOptionReReference').css('display', isref ? 'inline-block' : 'none');
			$('#contextOptionCreate').css('display', (isref || options.noCreate) ? 'none' : 'inline-block');
			
			// Starring
			$('.contextOptionToggleStar').css('display', 'inline-block'); //options.showStarToggle ? 'inline-block' : 'none');
			
			//if (options.showStarToggle) {
			var isStarred = (doc && doc.star);
			$('.contextOptionToggleStar').css('background-color', isStarred ? '#c40cf7' : '#ffffff');
			$('.contextOptionToggleStar').css('color', isStarred ? '#ffffff' : '#000000');
			//}
		} else {
			// Options for multiple documents
			$('.contextOptionReReference').css('display', 'none');
			$('.contextOptionToggleStar').css('display', 'none');
			$('.contextOptionShowInNavigation').css('display', 'none');
		}
	}
	
	/**
	 * Returns if the options are currently visible.
	 */
	optionsVisible() {
		return $('#treebuttons').css('display') != 'none';
	}
	
	/**
	 * Hides all option menus for the tree. Returns if the options have been visible before.
	 */
	hideOptions() {
		// Remove the close handler
		$(document).off('click', this.hideOptionsHandler);
		
		var visible = $('#treebuttons').css('display') != 'none';
		if (visible) {
			$('#treebuttons').css('display', 'none');
		}
		
		// TODO Also implement with callbacks!
		var t = NoteTree.getInstance();
		if (t.behaviour) {
			t.showRootOptions(true);
			t.showSettingsPanel(false);
			t.behaviour.afterHideOptionMenus(visible);
			t.deselectFavorites();
		}
		
		return visible;
	}
	
	/**
	 * Wrapper of hideOptions without return value, to be used as event handler.
	 */
	hideOptionsHandler() {
		// NOTE: There is no this scope when this is used as handler.
		Notes.getInstance().hideOptions();
	}

	/**
	 * Color changes can have aftermath in multiple places where an item is shown. This
	 * registers a callback for the given callback ID. Set the callbacks to null to disable.
	 * 
	 * The following has to be provided in the options object:
	 * - id: Internal ID for the callbacks. Trees/Boards etc. use their individual IDs.
	 * 
	 * - onColorInputPrepare(): Called before the color picker is shown. Params:
	 *     - doc: Document object
	 *     - isBackColor: Is the back color or text color changed?
	 *     - input: The color picker input element
	 *     
	 * - onColorInputUpdate(): Called after the color has been set on the document.
	 *     - doc: Document object
	 *     - isBackColor: Is the back color or text color changed?
	 *     - input: The color picker input element
	 */
	registerOptionsCallbacks(options) {
		if (!options.id) throw new Error('No callback ID passed');
		
		if (!this.optionsCallbacks) this.optionsCallbacks = new Map();
		
		this.optionsCallbacks.set(options.id, options);
	}
	
	/**
	 * Callback for color picker (set current color to the picker)
	 */
	prepareColorPicker(ids, input, back) {
		if (!ids.length) return;
		
		var docs = [];
		for(var i in ids) {
			var doc = this.getData().getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			docs.push(doc);
		}
		
		// Callbacks
		for(var [cbId, cbObj] of this.optionsCallbacks) {
			if (cbObj.onColorInputPrepare) {
				for(var d in docs) {
					cbObj.onColorInputPrepare(docs[d], back, input);
				}
			}
		}

		$(input).css('display', 'block'); 
		input.focus();
		
		// Set input initial value, taken from the first document.
		if (back) {
			input.value = docs[0].backColor ? docs[0].backColor : '#ffffff'; 
		} else {
			input.value = docs[0].color ? docs[0].color : '#000000'; 
		}
	}
	
	/**
	 * Callback for color picker (update color of the picker to the elements)
	 */
	setColorPreview(ids, input, back) {
		if (!ids.length) return;
		
		var docs = [];
		for(var i in ids) {
			var doc = this.getData().getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			docs.push(doc);
		}

		for(var d in docs) {
			if (back) {
				docs[d].backColor = input.value;
			} else {
				docs[d].color = input.value;
			}
		}
		
		// Callbacks
		for(var [cbId, cbObj] of this.optionsCallbacks) {
			if (cbObj.onColorInputUpdate) {
				for(var d in docs) {
					cbObj.onColorInputUpdate(docs[d], back, input);
				}
			}
		}
	}
	
	/**
	 * Callback for color picker (called at the end of picking, saving the metadata)
	 */
	setColor(ids, input, back) {
		this.hideOptions();
		
		if (!ids.length) return;

		this.setColorPreview(ids, input, back);
		$(input).css('display', 'none');
		
		var docs = [];
		for(var i in ids) {
			var doc = this.getData().getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			docs.push(doc);
		}
		
		var color = docs[0].color;
		var bgColor = docs[0].backColor;
		
		var that = this;
		DocumentAccess.getInstance().loadDocuments(docs)
		.then(function(resp) {
			for(var d in docs) {
				docs[d].color = color;
				docs[d].backColor = bgColor;
			}
			
			return DocumentAccess.getInstance().saveItems(ids);
		})
		.catch(function(err) {
    		that.showAlert("Error saving metadata: " + err.message, err.abort ? 'I' : 'E', err.messageThreadId);
    	});
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Sets a Data container
	 */
	setData(d) {
		this.data = d;
	}
	
	/**
	 * Returns the current data container
	 */
	getData() {
		return this.data;
	}
}