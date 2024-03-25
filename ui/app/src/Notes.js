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
	
	#updatedViews = false;
	
	constructor() { 
		this.appVersion = '1.0.4';      // Note: Also update the Cache ID in the Service Worker to get the updates through to the clients!

		this.optionsMasterContainer = "treeoptions_mastercontainer";
		this.outOfDateFiles = [];
	}
	
	/**
	 * Called initially on window load.
	 */
	run() { 
		var that = this;

		// Redirect console logging
		Console.init();
		
		// Print version
		console.info('Notes v' + this.appVersion);
		
		// Error handler
		this.errorHandler = new ErrorHandler(this);
		
		// Global error handling
		this.#initGlobalErrorHandler();

		// Enable caches for late loading of JS scripts
		$.ajaxSetup({
			cache: true
		});
		
		// Passive event listeners
		jQuery.event.special.touchstart = {
		    setup: function( _, ns, handle ) {
		        this.addEventListener("touchstart", handle, { passive: !ns.includes("noPreventDefault") });
		    }
		};
		jQuery.event.special.touchmove = {
		    setup: function( _, ns, handle ) {
		        this.addEventListener("touchmove", handle, { passive: !ns.includes("noPreventDefault") });
		    }
		};
		
		// Init handlers
		this.#initHandlers();
		
		// Initialize database
		this.setupDatabaseCallbacks();
		
		// CTRL-S key to save TODO put somewhere else
		$(window).bind('keydown', function(event) {
		    if (event.ctrlKey || event.metaKey) {
		        switch (String.fromCharCode(event.which).toLowerCase()) {
		        case 's':
		            event.preventDefault();
		            
					if (that.paging.isEditorDirty()) {
		            	that.paging.stopEditorDelayedSave();
		            	 
		            	var name2show = that.paging.getCurrentlyShownDoc() ? that.paging.getCurrentlyShownDoc().name : that.paging.getCurrentlyShownId();
		            	that.view.message("Saving " + name2show + "...", "I");   
		            
		            	that.actions.document.save(that.paging.getCurrentlyShownId(), that.paging.getEditorContent())
						.then(function(data) {
		            		if (data.message) that.view.message(data.message, "S");
		            	})
						.catch(function(err) {
		            		that.errorHandler.handle(err);
		            	});
		            }
		            break;		        
		        }
		    }
		});

		// Messages/Alerts box setup
		this.view.message("Welcome!", "I", {
			alwaysHideAtNewMessage: true
		});
		
		// Hide messages on click TODO modularize
		$('#messages').click(function() { 
			$('#messages').empty();
		});	
		
		// Set up application routing
		this.routing = new Routing(this, '#article');
		
		// Start routing.
		this.routing.run();
	}
	
	/**
	 * Initialize handler instances
	 */
	#initHandlers() {
		this.device = new Device(this);
		this.state = new ClientState(this);

		Document.setApp(this); // TODO
		
		this.documentAccess = new DocumentAccess(this);
		this.documentChecks = new DocumentChecks(this);
		this.views = new Views(this);
		this.callbacks = new Callbacks(this.errorHandler);
		this.styles = new Styles();
		this.settings = new Settings(this);
		this.hashtag = new Hashtag(this);
		
		this.actions = {
			attachment: new AttachmentActions(this, this.documentAccess),	
			board: new BoardActions(this, this.documentAccess),	
			document: new DocumentActions(this, this.documentAccess),	
			editor: new EditorActions(this, this.documentAccess),	
			hashtag: new HashtagActions(this, this.documentAccess),	
			history: new HistoryActions(this),	
			label: new LabelActions(this, this.documentAccess),	
			meta: new MetaActions(this, this.documentAccess),	
			reference: new ReferenceActions(this, this.documentAccess),	
			settings: new SettingsActions(this),	
			trash: new TrashActions(this, this.documentAccess),	
			nav: new NavigationActions(this, this.documentAccess),	
		};
		
		this.view = new View(this);
		
		this.nav = new NoteTree(this);
		this.paging = new Tab(this, $('<div class="contentContainer mainPanel"/>')); // TODO move to UI
	}
	
	/**
	 * This is for mobile device debugging: On IOS, no JS errors are visible, so
	 * we alert them here. 
	 */
	#initGlobalErrorHandler() {
		var that = this;
		window.onerror = function errorHandler(msg, url, line, columnNo, error) {
			if (that.device.isTouchAware()) {
				alert('Exception: ' + msg + ' in ' + url + ' line ' + line);
			}
			
			if (error && error.stack) {
				console.error(error.stack);
			} else {
				console.error(msg);
				console.error('  at:    ' + url);
				console.error('  line:  ' + line);
			} 
			
			console.trace();
			
			// Just let the default handler run.
			return false;
		}
	}
	
	/**
	 * Sets all callback handlers for the database
	 */
	setupDatabaseCallbacks() {
		var that = this;
		
		this.db = new Database({
			// State handler
			state: this.state,
			
			// Error handler
			handle: function(err) {
				that.errorHandler.handle(err);
			},
				
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
					that.state.saveProfiles({ profiles: arr });
				},
				getProfilesCallback: function() {
					return that.state.getProfiles().profiles;
				}
			},
			
			// Sync callbacks
			syncOptions: {
				// Message to the user
				alert: function(msg, type, options) {
					that.view.message(msg, type, options);
				},
				
				// Update the sync state button in the header
				updateSyncStatus: function() {
					that.updateSyncStatus();
				},
				
				// Called after manually syncing. Just reloads the tree.
				onManualSyncFinishedCallback: function() {
					return that.views.updateViews()
					.then(function(resp) {
						if (resp.docCreated) {
							that.view.message('Successfully initialized database views.', 'S');
						}
						return that.actions.nav.requestTree();
					});
				},
				
				// Called at active syncing
				syncActiveHandler: function(info) {
				},
				
				// Called when syncing has paused.
				syncPausedHandler: function() {
					// If not yet done, check the views.
					if (!that.#updatedViews) {
						that.#updatedViews = true;

						that.views.updateViews()
						.catch(function(err) {
							that.errorHandler.handle(err);
						});
					}
				},
				
				// Called when the live sync (autoSync) gets changes. Checks if the changes are relevant to the tree or the
				// opened document, and reloads whatever needs to be reloaded.
				onLiveSyncChangeCallback: function(change, change_seq, final_seq) {
					// Check if we need to update anything. This only applies when we get changes from the remote (pull).
					if (change.direction == "pull") {
						var percentage = 0;
						if (change_seq && final_seq) {
							percentage = parseFloat(change_seq) / parseFloat(final_seq);
						}
						
						// Progress bar
						that.showProgressBar(percentage);
						
						// Update loaded note if the changed document is currently opened
						if (that.paging.isEditorLoaded() && change.change) {
							for(var i in change.change.docs || []) {
								var doc = change.change.docs[i];
								if (doc._id.startsWith('_')) continue;
								
								if (doc._id == that.paging.getCurrentlyShownId()) {
									console.log("Sync: -> Re-requesting " + (doc.name ? doc.name : doc._id) + ", it has been changed and is opened in an Editor.");
									if (that.paging.isEditorDirty()) {
										that.paging.stopEditorDelayedSave();
										
										that.view.message('Warning: ' + (doc.name ? doc.name : doc._id) + ' has been changed remotely. If you save now, the remote version will be overwritten! Reload the app to keep the server version.', 'W');
									} else {
										that.actions.document.request(doc._id)
										.catch(function(err) {
											that.errorHandler.handle(err);
										})
									}
									break;
								}
							}
						}
						
						// In the final change, update views and trigger a tree request, reload global metadata.
						if (change_seq == final_seq) {
							that.showProgressBar(1);
							
							that.views.updateViews()
							.then(function(resp) {
								return that.actions.meta.requestGlobalMeta()
								.catch(function(err) {
									that.errorHandler.handle(err);
								});
							})
							.then(function() {
								return that.actions.nav.requestTree();
							})
							.catch(function(err) {
								that.errorHandler.handle(err);
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
									
									that.actions.meta.requestGlobalMeta()
									.catch(function(err) {
										that.errorHandler.handle(err);
									});
								} else if (!treeRequested) {
									// Update tree if something relevant has changed
									if (Document.containsTreeRelevantChanges(doc)) {
										console.log("Sync: -> Re-requesting tree, document " + (doc.name ? doc.name : doc._id) + " had relevant changes");
									
										that.actions.nav.requestTree()
										.catch(function(err) {
											that.errorHandler.handle(err);
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
	 * Loads a new page
	 */
	async loadPage(newPage, data) {
		this.resetPage();
		await this.paging.loadPage(newPage, data);
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
	triggerUpdateCheck(manually) {
		navigator.serviceWorker.ready
  		.then( (registration) => {
			if (registration.active) {
				registration.active.postMessage({
					requestId: 'checkUpdates',
					manually: manually  
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
		var p = this.db.profileHandler.getCurrentProfile();
		
		if (p.url && (p.url != 'local') && !p.clone) {
			var that = this; 
		
			this.view.message(
				'Warning: This notebook is not available offline. This may be slow with larger documents.', 
				'W', 
				'UnSyncedMessages',
				false, 
				function(msgElement, event) {
					that.routing.callSettings();
				}
			);
		}
	}

	/**
	 * Install updates.
	 */
	installUpdates() {
		this.view.message("Installing, please wait...", "I");  

		if (!navigator.serviceWorker) {
			this.view.message("No service worker active, try again or just reload the page.", "W"); 
			return;			
		}
		
		navigator.serviceWorker.ready
  		.then( (registration) => {
			if (registration.active) {
				registration.active.postMessage({
					requestId: 'update'
				});
			} else {
				this.view.message("No service worker active, try again or just reload the page.", "W");
			}
			/*if (registration.waiting) {
				registration.waiting.postMessage(42);  
			}*/
		});			
	} 
	
	#swCallbacks = null;  // Service worker callbacks
	
	/**
	 * Sets a message callback for receiving SW messages
	 */
	setServiceWorkerMessageCallback(id, callback) {
		if (!this.#swCallbacks) this.#swCallbacks = new Map();
		this.#swCallbacks.set(id, callback);
	}
	
	/**
	 * Removes a message callback for receiving SW messages
	 */
	removeServiceWorkerMessageCallback(id) {
		if (!this.#swCallbacks) return;
		this.#swCallbacks.delete(id);
	}
	
	/**
	 * Handlers incoming messages from the service worker.
	 */
	setupServiceWorkerMessageReceiver() {
		var that = this;
		 
		// Receive messages from the service worker.  
		navigator.serviceWorker.addEventListener('message', (event) => {
			// Out of date files (hard wired)
			if (event.data.outOfDate) {
				if (that.outOfDateFiles.length == 0) { 
					setTimeout(function() {
						that.view.message(
							"An update is available for this App. Please see the About page in the user menu to install it.", 
							"W", 
							{ 
								callback: function(msgElement, event) {
									that.routing.callUpdatePage();
								}
							}
						);
					}, 100); 
				}
 
				that.outOfDateFiles.push(event.data.url);
				
				return;
			}		
			
			// Other callback based messages
			if (event.data.requestId) {
				if (this.#swCallbacks) {
					var cb = this.#swCallbacks.get(event.data.requestId)
					
					if (cb) cb(event.data);			
				} 
			}					
			
			// Update requests
			console.log("Unhandled message from service worker: "); 
			console.log(event.data);	
		});
		
		// Register message handler callbacks: User message
		this.setServiceWorkerMessageCallback('userMessage', function(data) {
			const msg = data.message ? data.message : 'SW Message internal Error: No message transmitted';
			
			const type = data.type ? data.type : 'I';
			
			console.log("User message from SW received: Type " + type + ", message: " + msg);
			that.view.message(msg, type);
		});
		
		// Register message handler callbacks: Unregister service worker message
		this.setServiceWorkerMessageCallback('unregisterServiceWorker', function(/*data*/) {
			console.log("Service Worker triggers unregistering...");

			if (!confirm("Reinstall now? No notebook data will get lost.")) {
				that.view.message("Action cancelled", 'I');
				return;
			}

			navigator.serviceWorker.ready 
			.then(function(registration) {
				return registration.unregister();
			})
			.then(function(/*success*/) {
				that.view.message("Wait for the installation to complete...", 'I');
				
				setTimeout(function() {
					console.log("Reload page for the new SW to be installed");
					
					location.reload();
				}, 1000); 
			});
		});
	}
	
	/**  
	 * Registers the Service Worker.
	 */	
	registerServiceWorker() {
		if ('serviceWorker' in navigator) {
			var that = this;
			
		    navigator.serviceWorker
				.register('ServiceWorker.js')
				.then(function(registration) {
					console.log('ServiceWorker registration successful with scope ' + registration.scope);
					
					// Messages from the service worker
					that.setupServiceWorkerMessageReceiver();
				}, function(err) {
					console.log('ServiceWorker registration failed: ', err);
					that.view.message('ServiceWorker registration failed: ' + err, "E");
			    });
		}
	}
		
	/**
	 * Load the DBs and start the app. This is called before any route and returns a promise,
	 * after which the DB can be used.
	 */
	startApp(profile) {
		var that = this;
		
		// This checks for online connection every two seconds
		if (!this.onlineSensor) {
			this.onlineSensor = new OnlineSensor(this);
			this.onlineSensor.start(4000, function(data) {
				$('#onlineStatus').css('display', data.onLine ? 'none' : 'inline-block');
			});
		}
		
		// Import DB connection profile from URL
		if (profile) {
			// Import profile from URL
			try {
				if (this.db.profileHandler.importProfile(profile)) {
					// Reset databases: We have a new connection profile which has to be set up from scratch
					this.#updatedViews = false;
					
					this.db.reset();
				}
				
			} catch (e) {
				this.view.message('Error in connection address: ' + e);

				// Set up DOM tree
				this.setupDom();
				
				// Setup header buttons
				this.setButtons(null, true);
				
				// In case of an error loading the profile, we show the profile selection page.
				this.resetPage();
				this.loadPage(new ProfilesPage());
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
		this.state.setLastOpenedUrl(location.href);
		
		// Initialize database instance with the user ID. This is started asynchronously. After the database(s)
		// is/are up, the settings, notes tree and the last loaded note are requested independently.
		return this.db.init()
		.then(function(data) {
			// Update views in online mode if necessary (only do this the first time this is called at page load).
			// NOTE: Here we want to keep the chain short because this is always run for all routes,
			//       so we only do this the first time the app launches. In the pull requests during sync,
			//       the views are always checked as there is no hurry there.
			if (!that.db.profileHandler.getCurrentProfile().clone) {
				if (!that.#updatedViews) {
					that.#updatedViews = true;

					return that.views.updateViews()
					.then(function(resp) {
						return Promise.resolve(data);
					});
				}
			}
		
			return Promise.resolve(data);
		})
		.then(function(data) {
			// Load settings document
			if (data.initialised) {
				return that.actions.settings.requestSettings()
				.then(function() {
					return Promise.resolve(data);
				})
				.catch(function(err) {
					that.errorHandler.handle(err);
				});
			}
			
			return Promise.resolve(data);
		})
		.then(function(data) {
			// The tree and note requests can run in parallel from here on
			// for the most pages. For the others we also return the tree and
			// settings request promises so that following then() handlers can 
			// wait for them if they need to.
			var treePromise = null;
			
			if (data.initialised) {
				treePromise = that.actions.nav.requestTree()
				.catch(function(err) {
					that.errorHandler.handle(err);
				});
			}
			
			// Show remote DB status in loaded note display in the header on startup
			that.db.checkRemoteConnection()
			.then(function(resp) {
				if (!resp.ok) $('#loadedNote').html(resp.status);
			})
			.catch(function(err) {
				$('#loadedNote').html("No remote DB connected");
			});

			return Promise.resolve({
				ok: true,
				treePromise: treePromise
			});
		})
		.then(function(data) {
			// Load global metadata and the return the app start result from the previous step.
			return that.actions.meta.requestGlobalMeta()
			.then(function() {
				return Promise.resolve(data);				
			})
			.catch(function(err) {
				that.errorHandler.handle(err);
				return Promise.resolve(data);
			});
		})
		.catch(function(err) {
			// App start error handling: Show the error and resolve (else the app would be stuck here).
			that.errorHandler.handle(err);
			
			// Here we resolve, because the pages should be loaded nevertheless.
			return Promise.resolve({
				message: "Error connecting to database: " + err.stack,
				messageThreadId: err.messageThreadId
			});
		});
	}

	/**
	 * Resets the page content elements. treePage is set to true only for the profile root.
	 */
	resetPage(treePage) {
		if (this.paging.isEditorLoaded()) {
			if (this.paging.isEditorDirty() && (!this.paging.getEditorRestoreMode())) {
				var that = this;
				
				this.actions.document.save(that.paging.getCurrentlyShownId(), that.paging.getEditorContent())
				.then(function(data) {
	        		if (data.message) that.view.message(data.message, "S");
	        	})
				.catch(function(err) {
	        		that.errorHandler.handle(err);
	        	});
			}
		}

		this.paging.unload();
		
		this.setHeaderSelector();
		this.allowViewportScaling(false);
		this.hideMenu();
		
		this.setButtons(null, true);
		
		$('#backButton').hide();
		$('#editorNavButtons').hide();
		$('#forwardButton').hide();
		
		//$('#showNavButton').hide();

		$('#editor').hide();
		$('#console').hide();

		if (treePage) {
			this.paging.hide();
			$('#treenav').show();

			this.nav.setupFooter();

			if (this.device.isLayoutMobile()) {
				this.nav.refresh();
			}
		} else {
			this.paging.show();

			this.setupEditorFooter();

			if (this.device.isLayoutMobile()) {
				$('#treenav').hide();
				$('#editorNavButtons').show();
				
				this.nav.initEditorNavButtons();
			}
		}
		
		if (!this.device.isLayoutMobile()) {
			$('#backButton').show();
			$('#forwardButton').show();
		}
		
		const nbName = this.settings.settings.dbAccountName;
		if (nbName) {
			this.setWindowTitle('Notes | ' + nbName);			
		}
		
		this.setFocus(Notes.FOCUS_ID_EDITOR);
	}

	setWindowTitle(title) {
		document.title = title; 
	}
	
	editorBackButtonHandler(e) {
		e.stopPropagation();
		this.back();
	}
				
	editorForwardButtonHandler(e) {
		e.stopPropagation();
		this.forward();
	}
	
	editorHomeButtonHandler(e) {
		e.stopPropagation();
		this.home();
	}
	
	editorNavButtonHandler(e) {
		e.stopPropagation();
		
		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 

		if (upright) {
			this.toggleShowNavigation(true);
		} else {
			var id = this.paging.getCurrentlyShownId();
			this.nav.highlightDocument(id);	
		}
	}
	
	editorLinkageButtonHandler(e) {
		e.stopPropagation();
		this.toggleEditorLinkage();
	}
	
	editorCreateButtonHandler(e) {
		e.stopPropagation();
		
		var that = this;
		this.actions.document.create(this.nav.behaviour.getNewItemParent())
		.then(function(data) {
			//t.unblock();
			if (data.message) {
				that.view.message(data.message, "S");
			}
		})
		.catch(function(err) {
			//t.unblock();
			that.errorHandler.handle(err);
		});
	}
	
	editorFavoritesButtonHandler(e) {
		e.stopPropagation();
		
		var selector = this.getFavoritesSelector('footerFavoritesSelector');
		selector.val('');
		
		var that = this;
		this.showGenericDialog(
			// Init
			function(dialog, e, resolve, reject) {
				dialog.find('.modal-content').append(
					$('<div class="modal-header"><h5 class="modal-title">Open Document from Favorites List:</h5></div>'),
					$('<div class="modal-body"></div>').append(
						selector
						.on('change', function(/*event*/) {
				        	var target = this.value;
					        
							dialog.modal('hide');
							that.routing.call(target);
						})
					)
				);
				
				setTimeout(function() {
					selector.selectize({
						sortField: 'text'
					});
				}, 0);
				
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
		const favs = this.nav.getFavorites();

		var favoritesNum = this.state.getViewSettings().favoritesNum;
		
		var selector =  $('<select id="' + elementId + '"></select>');
		
		const that = this;
		function addOption(id) {
			selector.append(
				$('<option value="' + id + '">' + that.view.formatSelectOptionText(that.data.getReadablePath(id, null, true)) + '</option>')
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
		
		this.footer = $('<div id="editorFooter" class="footer"></div>');
		this.footerAttached = true;
		
		var that = this;
		$('#all').append([
			// Content
			$('<section>').append([
				// Navigation (grid)
				this.device.isLayoutMobile() 
					? 
					$('<nav id="treenav"></nav>') 
					: 
					$('<nav id="treenav"></nav>')
					.css('width', this.state.getTreeState().treeWidth),  // Pre-set tree width here
				
				// Main content
				$('<article id="article"></article>').append([  // TODO make div
					
					// Content container, used by most of the pages
					this.paging.getContainer().append(teaser),
					
					// Note Editor (for TinyMCE this is needed separately)
					//RichtextEditor.getContainerDom(teaser),  // TODO cleanup
					
					// Console  TODO use normal container
					//$('<div id="console" class="mainPanel"/>') 				
				])
				.on('click', function(event) {
					that.setFocus(Notes.FOCUS_ID_EDITOR);
				})
				.on('touchstart', function(event) {
					that.setFocus(Notes.FOCUS_ID_EDITOR);
				})
			]),
			
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
						$('<span data-toggle="tooltip" title="Synchronizing to remote database..." class="fa fa-sync headerButtonLeft headerElementLeft" id="syncStatusSyncing"/>')
						.on('click', function(e) {
							e.stopPropagation();
							that.db.syncHandler.syncManually();
						}),
						
						$('<span data-toggle="tooltip" title="Sync Status: OK" class="fa fa-check headerButtonLeft headerElementLeft" id="syncStatusOk" />')
						.on('click', function(e) {
							e.stopPropagation();
							that.db.syncHandler.syncManually();
						}),
						
						$('<span data-toggle="tooltip" title="Sync Status: Out of sync" class="fa fa-bolt headerButtonLeft headerElementLeft" id="syncStatusDirty" />')
						.on('click', function(e) {
							e.stopPropagation();
							that.db.syncHandler.syncManually();
						}),
						
						$('<span data-toggle="tooltip" title="Sync Status: Unknown" class="fa fa-question headerButtonLeft headerElementLeft" id="syncStatusUnknown" />')
						.on('click', function(e) {
							e.stopPropagation();
							that.db.syncHandler.syncManually();
						}),
						
						$('<span data-toggle="tooltip" title="Sync Status: Paused" class="fa fa-pause headerButtonLeft headerElementLeft" id="syncStatusPaused" />')
						.on('click', function(e) {
							e.stopPropagation();
							that.db.syncHandler.syncManually();
						}),
						
					]),

					$('<span id="onlineStatusContainer" />').append([
						$('<span data-toggle="tooltip" title="Offline" class="fa fa-plane headerElementLeft" id="onlineStatus"/>'),
					]),
					
					$('<span id="headerPathContainer" />'),

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
			
			this.footer
		]);

		// Also setup the navigation tree
		this.nav.setupDom();
	
		addResizeListener($('#treenav')[0], function(/*event*/) {
			if (that.device.isLayoutMobile()) return;
			
			const newWidth = $('#treenav').outerWidth();
			if (!newWidth) return;

			var state = that.state.getTreeState();
			state.treeWidth = newWidth;
			that.state.setTreeState(state);
		});
	
		// Setup the generically reused option buttons
		(new ContextMenu(this)).setupItemOptions(this.optionsMasterContainer);
		
		// We only do this once ;)
		this.isDomSetup = true;
	}
	
	/**
	 * Sets up the footer for editors on mobile.
	 */
	setupEditorFooter() {
		var that = this;
		this.setFooterContent([
			// Back button used to navigate back to the tree in mobile mode
			$('<div id="backButton2" class="footerButton fa fa-chevron-left" data-toggle="tooltip" title="Navigate back"></div>')
			.on('click', function(e) {
				return that.editorBackButtonHandler(e);
			}),
			
			// Forward button used to navigate back to the tree in mobile mode
			$('<div id="forwardButton2" class="footerButton fa fa-chevron-right" data-toggle="tooltip" title="Navigate forward"></div>')
			.on('click', function(e) {
				return that.editorForwardButtonHandler(e);
			}),

			$('<div id="navButton2" class="footerButton fa fa-map" data-toggle="tooltip" title="Show this document in the navigation panel"></div>')
			.on('click', function(e) {
				return that.editorNavButtonHandler(e);
			}),
				
			$('<div id="homeButton2" class="footerButton fa fa-home" data-toggle="tooltip" title="Go to the notebook home in the navigation panel"></div>')
			.on('click', function(e) {
				return that.editorHomeButtonHandler(e);
			}),

			// Create note
			$('<div id="createButton2" class="footerButton fa fa-plus" data-toggle="tooltip" title="Create new item"></div>')
			.on('click', function(e) {
				return that.editorCreateButtonHandler(e);
			}),
		]);
	}
	
	/**
	 * In upright mode, this toggles showing/hiding the navigation panel.
	 */
	toggleShowNavigation(show) {
		this.showNavigationInUprightMode = show;
		
		this.update();
		
		var that = this;
		setTimeout(function() {
			that.nav.filter();
			
		}, Config.presentationModeAnimationTime + 2);
	}
	
	/**
	 * Toggle linkage from navigation to editor 
	 */
	toggleEditorLinkage() {
		var linkEditorMode = this.state.getLinkageMode('editor');
		
		linkEditorMode = this.device.isLayoutMobile() ? 'off' : ((linkEditorMode == 'on') ? 'off' : 'on');
		
		this.state.setLinkageMode('editor', linkEditorMode);
		
		this.updateLinkageButtons();
		
		this.setFocus(Notes.FOCUS_ID_EDITOR);
	}

	/**
	 * Restore linkage settings for the editor button.
	 */	
	restoreEditorLinkage() {
		this.updateLinkageButtons();
	}
	
	/**
	 * Update the linkage button's appearance.
	 */
	updateLinkageButtons() {
		var page = this.paging.getCurrentPage();
		var pageSupport = (this.paging.isEditorLoaded()) || (page && 
		       (typeof page.supportsLinkageFromNavigation == 'function') && 
		       page.supportsLinkageFromNavigation()
		);
		
		var linkEditorMode = this.state.getLinkageMode('editor');
		
		$('#linkEditorButton').css('display', (this.device.isLayoutMobile() || (!this.nav.supportsLinkEditorToNavigation()) || (!pageSupport)) ? 'none' : 'block');
		$('#linkEditorButton').css('background-color', (linkEditorMode == 'on') ? '#c40cf7' : '#ffffff');
		$('#linkEditorButton').css('color', (linkEditorMode == 'on') ? '#ffffff' : '#000000');
		$('#linkEditorButton').attr('title', (linkEditorMode == 'on') ? 'Unlink editor from navigation' : 'Link editor to navigation');
	}
	
	
	static FOCUS_ID_EDITOR = 'editor';   // #IGNORE static
	static FOCUS_ID_NAVIGATION = 'nav';  // #IGNORE static

	focusId = Notes.FOCUS_ID_EDITOR;

	/**
	 * Returns the current focus ID.
	 */
	getFocusId() {
		// Check if the page provides an override for focussing
		var override = this.paging.overrideFocusId();
		if (override) {
			return override;
		}
		
		return this.focusId;
	}
	
	/**
	 * Set ID of focussed area.
	 */
	setFocus(id) {
		this.focusId = id;

		if (id == Notes.FOCUS_ID_EDITOR) this.toggleShowNavigation(false);

		this.update();
	}
	
	/**
	 * Go home to the navigation root
	 */
	home() {
		this.nav.resetScrollPosition('all');
		this.nav.focus("");
		
		if (this.device.isLayoutMobile()) {
			this.routing.call();			
		}
	}
		
	/**
	 * Browser back functionality
	 */
	browserBack() {
		this.state.setLastOpenedUrl();
		
		history.back();
	}
	
	/**
	 * Go back in browser history
	 */
	back() {
		if (this.device.isLayoutMobile()) {
			this.browserBack();
		} else {
			if (this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) {
				this.nav.appBackButtonPushed();
			} else {
				// Editor focussed
				this.browserBack();
			}
		}
	}
	
	/**
	 * Browser forward functionality
	 */
	browserForward() {
		this.state.setLastOpenedUrl();
		
		history.forward();
	}
		
	/**
	 * Go forward in browser history
	 */
	forward() {
		if (this.device.isLayoutMobile()) {
			this.browserForward();
		} else {
			if (this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) {
				this.nav.appForwardButtonPushed();
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
			const history = this.nav.getHistory();
			
			if (history) {
				const deactivatedColor = Tools.blendColors(0.2, this.getMainColor(), this.getTextColor());
				
				backButt.css('color', (this.nav.historyCanBack() ? '' : deactivatedColor));
				forwardButt.css('color', (history.canForward() ? '' : deactivatedColor));
			}
		}
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
		this.nav.refresh();
		this.routing.refresh();
	}
	
	/**
	 * Updates the sync status icon below the tree, according to the database sync status.
	 */
	updateSyncStatus() {
		var state = this.db.syncHandler.syncState;
		if (!state || state == "") {
			if (this.db.profileHandler.getCurrentProfile().clone) {
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
		$(document).off('click.hideMenuHandler');
		$(document).off('keydown.menuKeydownHandler');
		
		$('#userMenuContainer').empty();
		this.menuId = false;
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
		
		var that = this;
		$(document).on('click.hideMenuHandler', function() {
			that.hideMenu();
		});
		$(document).on('keydown.menuKeydownHandler', function(e) {
			if(e.which == 27) {
				e.stopPropagation();
				
				that.hideMenu();
		    }
		});
	}
	
	/**
	 * Returns what the notebook should be shown to be named like.
	 */
	getCurrentNotebookVisibleName() {
		const s = this.settings.settings;
		const p = this.db.profileHandler;
		
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

				// Select notebook
				$('<div class="userbutton" id="selProfileMenuItem"><div class="fa fa-home userbuttonIcon"></div>Select Notebook</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callSelectProfile();
				}),
				
				// Graph
				!that.state.experimentalFunctionEnabled(GraphPage.experimentalFunctionId) ? null :
				$('<div class="userbutton" id="graphMenuItem"><div class="fa fa-project-diagram userbuttonIcon"></div>Graph</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callGraphView();
				}),
				
				// Conflicts
				$('<div class="userbutton" id="conflictsMenuItem"><div class="fa fa-bell userbuttonIcon"></div>Conflicts</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callConflicts();
				}),
				
				$('<div class="userbuttonLine"></div>'),

				// Synchronize manually
				$('<div class="userbutton" id="syncMenuButton"><div class="fa fa-sync userbuttonIcon"></div>Synchronize</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.db.syncHandler.syncManually();
				}),
				
				// Settings
				$('<div class="userbutton"><div class="fa fa-cog userbuttonIcon"></div>Settings</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callSettings();
				}),
				
				// All hashtags
				$('<div class="userbutton"><div class="fa fa-hashtag userbuttonIcon"></div>All Hashtags</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callHashtags();
				}),
				
				// All labels
				$('<div class="userbutton"><div class="fa fa-tags userbuttonIcon"></div>All Labels</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callLabelDefinitions();
				}),
				
				// Console
				$('<div class="userbutton"><div class="fa fa-terminal userbuttonIcon"></div>Console</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callConsole();
				}),
				
				// Trash bin
				$('<div class="userbutton"><div class="fa fa-trash userbuttonIcon"></div>Trash</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.routing.callTrash();
				}),
				
				// Help
				$('<div class="userbutton"><div class="fa fa-question userbuttonIcon"></div>Help</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.hideMenu();
					
					setTimeout(function() {
						that.routing.callDocumentation();
					},100);
				}),
				$('<div class="userbutton"><div class="fa fa-info userbuttonIcon"></div>About...</div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.hideMenu();
					
					setTimeout(function() {
						that.routing.callAbout();
					},100);
				}),
			]);
			 
			$('#syncMenuButton').css('display', that.db.profileHandler.getCurrentProfile().clone ? 'block' : 'none');
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
		var g = this.state.getLocalSettings();
		if (g) {
			if (this.device.isLayoutMobile()) {
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
		return this.device.isLayoutMobile() ? Config.defaultButtonSizeMobile : Config.defaultButtonSizeDesktop;
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
		var g = this.state.getLocalSettings();
		if (g) {
			if (this.device.isLayoutMobile()) {
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
		return this.device.isLayoutMobile() ? Config.defaultHeaderSizeMobile : Config.defaultHeaderSizeDesktop;
	}
	
	/**
	 * Returns the (main, means: mobile) footer size.
	 */
	getFooterSize() {
		var g = this.state.getLocalSettings();
		if (g) {
			if (this.device.isLayoutMobile()) {
				if (g.footerSizeMobile) {
					return parseFloat(g.footerSizeMobile);
				}
			} else {
				if (g.footerSizeDesktop) {
					return parseFloat(g.footerSizeDesktop);
				}
			}
		}
		
		// Default
		return this.device.isLayoutMobile() ? Config.defaultFooterSizeMobile : Config.defaultFooterSizeDesktop;
	}
	
	/**
	 * Adds the passed element(s) to the footer after clearing it. elements may be an element or a list of elements.
	 */
	setFooterContent(elements) {
		this.#clearFooters();
		if (elements) this.#getFooter().append(elements);
	}
	
	/**
	 * Clear all footers.
	 */
	#clearFooters() {
		$('#editorFooter').empty();
		$('#navFooter').empty();
	}
	
	/**
	 * Returns the current footer element.
	 */
	#getFooter() {
		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 

		return (mobile || upright) ? this.footer : $('#navFooter');  
	}
	
	#attachFooter() {
		if (this.#getFooter() != this.footer) return;
		if (this.footerAttached) return;
		
		$('#all').append(this.footer);
		this.footerAttached = true;
	}
	
	#detachFooter() {
		if (this.#getFooter() != this.footer) return;		
		if (!this.footerAttached) return;
		
		this.footer.detach();
		this.footerAttached = false;
	}
	
	#updateFooterVisibility() {
		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 

		
		$('#editorFooter').css('display', (mobile || upright) ? 'grid' : 'none');
		$('#navFooter').css('display', (mobile || upright) ? 'none' : 'grid');
	}
	
	/**
	 * Update the header CSS to its defined size.
	 */
	updateDimensions() {
		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 
		
		const hdrSize = this.getHeaderSize();
		const ftrSize = this.getFooterSize();
		const winWidth = $(window).width();
		const winHeight = $(window).height();
		const sectionHeight = (winHeight - (hdrSize + ((mobile || upright) ? ftrSize : 0)));

		// Common containers: All content
		$('#all').css('height', winHeight + 'px');
		
		// Middle area (Nav and Content)
		const section = $('section');
		section.css('top', hdrSize + 'px');   
		section.css('height', sectionHeight + 'px');
		section.css('flex-direction', mobile ? 'column' : 'row');			

		// Navigation area
		const nav = $('nav');
		if (nav) {
			const navHeight = (winHeight - hdrSize - ((mobile || upright) ? ftrSize : 0));
			//const navHeight = sectionFullscreen ? winHeight : (winHeight - hdrSize - (mobile ? ftrSize : 0));
			//nav.css('height', navHeight + 'px');
			nav.css('height', mobile ? '100%' : (navHeight + 'px'));

			nav.css('min-height', navHeight + 'px');
			nav.css('max-height', navHeight + 'px');			

			nav.css('flex', mobile ? 2 : 'none');
			nav.css('resize', mobile ? '' : 'horizontal');
			
			nav.toggleClass('navFloating', !upright);			
			nav.toggleClass('navFixed', upright);			
		}
		
		// Content area
		const article = $('article');
		if (article) {
			article.toggleClass('articleFloating', !upright);			
			article.toggleClass('articleFixed', upright);
			article.css('width', upright ? (winWidth + 'px') : '');
			article.css('height', upright ? (sectionHeight + 'px') : '');
		}

		const navContainer = $('#treeContainer');
		if (navContainer) {			
			const navContainerHeight = winHeight - hdrSize - ftrSize;
			navContainer.css('height', navContainerHeight + 'px');
			navContainer.css('min-height', navContainerHeight + 'px');
			navContainer.css('max-height', navContainerHeight + 'px');			
		}			
		
		// Footer
		this.#updateFooterVisibility();
		const footer = this.#getFooter(); //$('#footer');
		if (footer) {
			footer.css('display', 'grid'); 
			footer.css('height', ftrSize + 'px');
			
			const maxFooterTextSize = (mobile ? winWidth : this.nav.getContainerWidth()) / 5 - 10;
			footer.css('font-size', Math.min(Math.max(ftrSize / 1.6, 10), maxFooterTextSize) + 'px');		
		}
		
		// Header
		const header = $('header');
		header.css('height', hdrSize + 'px');
		
		// Left header
		this.setHeaderButtonSize($('.headerElementLeft'), hdrSize);
		
		const headerText = $('#headerText');
		if (headerText) {
			headerText.css('font-size', hdrSize * (20/55) + 'px');
			headerText.css('padding-top', hdrSize * (12/55) + 'px');			
		}

		const headerPathContainer = $('#headerPathContainer');
		if (headerPathContainer) {
			headerPathContainer.css('font-size', hdrSize * (20/55) + 'px');
			headerPathContainer.css('padding-top', hdrSize * (12/55) + 'px');		
		}
		
		// Right header
		this.setHeaderButtonSize($('.headerButton'), hdrSize);
		
		const alertNotification = $('.alertHeaderNotification');
		if (alertNotification) {
			alertNotification.css('top', hdrSize * (6/55) + 'px');
			alertNotification.css('right', hdrSize * (6/55) + 'px');			
		} 
		
		// User menu
		const userMenu = $('.userbuttons');
		userMenu.css('top', hdrSize + 'px');
		userMenu.css('max-height', (winHeight - hdrSize - 10) + 'px');
		
		// Alert notification icon at user menu icon
		this.setRoundedButtonSize(hdrSize * (8 / 55), '.alertNotification');
		
		// Option icons
		this.setRoundedButtonSize(this.getRoundedButtonSize());

		const showFooterNavButton = (mobile || (upright && !this.showNavigationInUprightMode));
		$('#navButton2').css('display', showFooterNavButton ? 'block' : 'none');
		$('#homeButton2').css('display', showFooterNavButton ? 'none' : 'block');

		// Animated stuff	
		var that = this;
		function animateDimensions() {
			that.#animateDimensions();	
		};
		clearTimeout(animateDimensions);
		setTimeout(animateDimensions, 100);
	}
	
	/**
	 * Animated parts of updateDimensions()
	 */
	#animateDimensions() {
		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 

		const treeWidth = this.nav.getContainerWidth();
		
		const nav = $('nav');
			
		//footer.css('display', 'grid');
		this.#attachFooter();
			
		// Portrait mode
		if (!mobile) {
			if (upright && (!this.showNavigationInUprightMode)) {
				nav.animate({ left: '-' + treeWidth+ 'px' }, {
					queue: false,
					duration: Config.presentationModeAnimationTime,
					complete: function() {
						nav.css('display', 'none');
					}
				});	
			} else {
				nav.css('display', 'block');
				nav.animate({ left: '0px' }, {
					queue: false,
					duration: Config.presentationModeAnimationTime
				});
			}			
		}
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
		} else {
			var that = this;
			function headerSelectDocumentHandler(e) {
				return that.#headerSelectDocument(e);
			}
			
			$('#loadedNote').on('click', headerSelectDocumentHandler);
			//$('#loadedNote').css('cursor', 'auto');
		}

		$('#loadedNote').css('cursor', 'pointer');
	}
	
	/**
	 * Event handler which lets the user select another document to open.
	 */
	#headerSelectDocument(e) {
		e.stopPropagation();
		
		var selector = this.view.getDocumentSelector(false, true);
		selector.val('');
		
		var that = this;
		this.showGenericDialog(
			// Init
			function(dialog, e, resolve, reject) {
				dialog.find('.modal-content').append(
					$('<div class="modal-header"><h5 class="modal-title">Open Document:</h5></div>'),
					$('<div class="modal-body"></div>').append(
						selector
						.on('change', function(/*event*/) {
				        	var target = this.value;
					        
							dialog.modal('hide');
							that.routing.call(target);
						})
					)
				);
				
				setTimeout(function() {
					selector.selectize({
						sortField: 'text'
					});
					selector.val('');
				}, 50);
				
				// TODO Open selector immediately (seems to be difficult)
			},
			
			// Hide
			function(dialog, e, resolve, reject) {
				resolve();
			},
		);
	}

	/**
	 * Shows the header target selector for the given ID, or hides it if id is falsy.
	 */
	setHeaderSelector(id) {
		if (!this.data) return;
		
		if (!id) { 
			$('#headerPathContainer').empty();
			return;
		}
		
		var doc = this.data.getById(id);
		if (!doc) return null;

		var that = this;
		$('#headerPathContainer').empty();
		if (doc.parent) {
			$('#headerPathContainer').append(this.data.getLinkedPath(doc.parent, false, false, function(cbdoc) {
				// Open document by header path link
				that.routing.call(cbdoc._id);
			}));
		}
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
		var that = this;
		$('#headerRight').append(
			this.setHeaderButtonSize(
				$('<div type="button" data-toggle="tooltip" title="User Menu" class="fa fa-user headerButton" id="userMenuButton"></div>')
				.on('click', function(e) {
					e.stopPropagation();
					that.showUserMenu();
				}), 
				size
			),
			this.setHeaderButtonSize($('<div class="alertHeaderNotification alertNotification conflictMarker fa fa-bell"></div>'), size, true, 0.04),
		);
		
		// Update UI
		if (!noUpdate) this.update();
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
		this.setChangeMarker(this.paging.isEditorDirty());
		
		// Hide user menu
		if (!dontHideUserMenu) this.hideMenu();

		this.hideOptions();

		const mobile = this.device.isLayoutMobile();
		const upright = !mobile && (this.device.getOrientation() == Device.ORIENTATION_PORTRAIT); 

		// Focus
		if (mobile || upright) {
			$('#treenav').css('border', 'none');
			$('#article').css('border', 'none');
		} else {
			$('#treenav').css('border-bottom', ((this.getFocusId() == Notes.FOCUS_ID_NAVIGATION) ? ('3px solid ' + Config.focusColor) : '3px solid darkgrey'));
			$('#article').css('border-bottom', ((this.getFocusId() == Notes.FOCUS_ID_EDITOR) ? ('3px solid ' + Config.focusColor) : '3px solid darkgrey'));
		}

		// Update tree (hide options and update selected item to match the editor)
		this.nav.updateSelectedState();
		this.nav.setTreeTextSize(this.nav.getTreeTextSize());
		
		this.updateSyncStatus();
		
		// Adjust height for large trees
		$('section').css('min-height', $('#treecontainer').outerHeight() + 20);
		
		// Update move target selector if there is an active editor and the currently shown selector is out of date
		this.setHeaderSelector(this.paging.getCurrentlyShownId(true));

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
		$('.conflictMarker').css('display', (this.data && this.data.hasConflicts()) ? 'inline-block' : 'none');

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
		
		var favorites = this.state.getFavorites();
		var hash = Tools.hashCode(doc._id);
		
		if (!favorites["doc" + hash]) {
			favorites["doc" + hash] = {
				id: doc._id,
				rank: 1
			}
		} else {
			favorites["doc" + hash].rank ++;
		}
		
		this.state.saveFavorites(favorites);
		
		this.nav.updateFavorites();
	}
	
	/**
	 * Remove favorites entry for given document ID.
	 */
	removeFavorite(id) {
		if (!id) return;
		
		var favorites = this.state.getFavorites();
		var hash = Tools.hashCode(id);
		
		if (!favorites["doc" + hash]) return;

		favorites["doc" + hash] = false;
		
		this.state.saveFavorites(favorites);
		
		this.nav.updateFavorites();
	}
	
	/**
	 * Clear local favorites.
	 */
	clearFavorites() {
		if (!confirm('Clear favorites for this notebook?')) {
			this.view.message('Action cancelled.', 'I');
			return;
		}
		
		this.state.saveFavorites({});
		
		this.nav.updateFavorites();
	}
	
	/**
	 * Alerting. If you pass a thread ID, all older messages with the same ID will be removed first.
	 * Default type is "E". alwaysHideAtNewMessage can be used if you like to have the message disappearing whenever a new one comes in.
	 * callbackFunction is optional and executed on clicking the message.
	 *
	showAert(msg, type, threadID, alwaysHideAtNewMessage, callbackFunction) {
		if (!type) type = 'E';
		
		var msgEl = $('<div class="singleMessageContainer">' + msg + '</div>');
		var msgCont = $('<tr></tr>').append($('<td class="singleMessageContainerTd"></td>').append(msgEl));
		var fadeTime = 0;
		
		switch (type) {
		case 'E':
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_ERROR_FADEOUT_AFTER_MS;     // TODO fade out via CSS!
			console.error(msg);
			break;
		case 'W':
			msgEl.addClass("btn btn-warning");
			fadeTime = Config.MESSAGE_WARNING_FADEOUT_AFTER_MS;
			console.warn(msg);
			break;
		case 'S':
			msgEl.addClass("btn btn-success");
			fadeTime = Config.MESSAGE_SUCCESS_FADEOUT_AFTER_MS;			
			console.log(msg);
			break;
		case 'I':
			msgEl.addClass("btn btn-info");
			fadeTime = Config.MESSAGE_INFO_FADEOUT_AFTER_MS;
			console.log(msg);
			break;
		default:
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_OTHERS_FADEOUT_AFTER_MS; 
			console.error(msg);
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
				showClearFavorites: false
			};
		}
		
		this.hideOptions();
		if (!ids.length) return;
		
		this.optionsIds = Tools.removeDuplicates(ids);
		this.optionOptions = options;
		
		var x = (this.device.isLayoutMobile() ? pageX - $('#treebuttons').width() : pageX) + Config.CONTEXT_OPTIONS_XOFFSET;
		if (x < 0) x = 0;
		
		var y = pageY + Config.CONTEXT_OPTIONS_YOFFSET;
		
		$('#treebuttons').css({
			display: "block",
			left: x,
			top: y
		});
		
		this.updateOptionStyles();
		
		// Add global removal handler
		var that = this;
		$(document).on('click.hideOptionsHandler', function() {
			that.hideOptions();
		});
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
			var doc = this.data.getById(this.optionsIds[0]);
	
			// Options: (default: hidden)
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
		$(document).off('click.hideOptionsHandler');
		
		var visible = $('#treebuttons').css('display') != 'none';
		if (visible) {
			$('#treebuttons').css('display', 'none');
		}
		
		// TODO Also implement with callbacks!
		if (this.nav.behaviour) {
			this.nav.showRootOptions(true);
			this.nav.showSettingsPanel(false);
			this.nav.behaviour.afterHideOptionMenus(visible);
			this.nav.deselectFavorites();
		}
		
		return visible;
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
			var doc = this.data.getById(ids[i]);
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
			var doc = this.data.getById(ids[i]);
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
			var doc = this.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			docs.push(doc);
		}
		
		var color = docs[0].color;
		var bgColor = docs[0].backColor;
		
		var that = this;
		this.documentAccess.loadDocuments(docs)
		.then(function(resp) {
			for(var d in docs) {
				docs[d].color = color;
				docs[d].backColor = bgColor;
			}
			
			return that.documentAccess.saveItems(ids);
		})
		.catch(function(err) {
    		that.errorHandler.handle(err);
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
}