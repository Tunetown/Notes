/**
 * Note taking app - App Routing based on sammy.js
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
class Routing {
	
	constructor(app, selector) {
		this.app = app;
		this.setup(selector);
	}
	
	/**
	 * Set up routing
	 */
	setup(selector) {
		var that = this;
		this.sammy = $.sammy(selector, function() {
			// Select notebook site (this redirects to the last loaded site if the landing page
			// has been loaded)
			function landingPage(context, regardLastLoaded) {
				var lastLoaded = regardLastLoaded ? ClientState.getInstance().getLastOpenedUrl() : false;

				that.app.startApp()
				.then(function(data) {
					that.app.resetPage();
					
					if (lastLoaded) {
						console.log("Redirect to last loaded: " + lastLoaded);
						location.href = lastLoaded;
					} else {
						Profiles.getInstance().load();
					}
				
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			}
			this.get('#/', function(context) {
				landingPage(context, true);
			});
			this.get('#/notebooks', function(context) {
				landingPage(context, false);
			});

			// Documentation
			this.get('#/doc', function(context) {
				that.app.startApp()
				.then(function(data) {
					that.app.resetPage();
					Help.getInstance().load();
				})
				.catch(function(err) {
					that.app.showAlert('Error loading help page: ' + err.message, 'E', err.messageThreadId);
				});
			});
			this.get('#/doc/:docpage', function(context) {
				var docpage = this.params['docpage'];
				
				that.app.startApp()
				.then(function(data) {
					that.app.resetPage();
					Help.getInstance().load(docpage);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading help page: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Console
			this.get('#/console', function(context) {
				that.app.startApp()
				.then(function(data) {
					that.app.resetPage();
					Console.getInstance().show();
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Update page
			this.get('#/update', function(context) {
				that.app.startApp()
				.then(function(data) {
					that.app.resetPage();
					Update.getInstance().load();
				})
				.catch(function(err) {
					that.app.showAlert('Error loading update page: ' + err.message, 'E', err.messageThreadId);
				});
			});
						
			// Profile root: Show overview
			function profileRoot(context, params) {
				return that.app.startApp(params['profile'])
				.then(function(data) {
					that.app.resetPage(true);
					that.app.setStatusText();
					return Promise.resolve({
						ok: true,
						startAppData: data
					});
				})
			};
			this.get('#/:profile', function(context) {
				profileRoot(context, this.params)
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			this.get('#/:profile/', function(context) {
				profileRoot(context, this.params)
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Profile root with search text passed as URI parameter
			this.get('#/:profile/search/:token', function(context) {
				const token = this.params['token'];
				profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok || !token || !resp.startAppData) return Promise.reject();
					
					return Promise.resolve(resp.startAppData.treePromise);
				})
				.then(function() {
					NoteTree.getInstance().setSearchText(token);
				});
			});
			
			// Profile root with selected parent ID passed as URI parameter
			this.get('#/:profile/select/', function(context) {
				profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok || !resp.startAppData) return Promise.reject();
					
					return Promise.resolve(resp.startAppData.treePromise);
				})
				.then(function() {
					NoteTree.getInstance().focus('');
				});
			});
			this.get('#/:profile/select/:parent', function(context) {
				const parent = this.params['parent'];
				profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok || !resp.startAppData) return Promise.reject();
					
					return Promise.resolve(resp.startAppData.treePromise);
				})
				.then(function() {
					NoteTree.getInstance().focus(parent ? parent : '');
				});
			});
			
			// Settings
			this.get('#/:profile/settings', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.resolve(data.settingsPromise)
					.then(function(data) {
						that.app.resetPage();
						Settings.getInstance().load();
					})
					.catch(function(err) {
						that.app.resetPage();
						that.app.setStatusText('No settings found', 'W');
						Settings.getInstance().load();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Generator
			this.get('#/:profile/generate', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.resolve(data.treePromise);
				})
				.then(function(data) {
					that.app.resetPage();
					Generate.getInstance().load();
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Graph view
			this.get('#/:profile/graph', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.all([data.treePromise, data.settingsPromise])
					.then(function(data) {
						GraphView.getInstance().load();
						return Promise.resolve();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Trash bin
			this.get('#/:profile/trash', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					// NOTE: The trash bin needs the basic tree data only to reference 
					//       parents. This is why we wait for the tree here.
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return TrashActions.getInstance().showTrash();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading trash: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Checks
			this.get('#/:profile/check', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					Check.getInstance().load();
				})
				.catch(function(err) {
					that.app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// All conflicts
			this.get('#/:profile/conflicts', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					// NOTE: This needs all tree data, so we wait for the tree promise first
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return Conflicts.getInstance().load();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading conflicts: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// All hashtags
			this.get('#/:profile/tags', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return Hashtags.getInstance().load();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading tags overview: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Hashtags of a note
			this.get('#/:profile/tags/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return Hashtags.getInstance().load(noteId);
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading tags overview: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// All labels
			this.get('#/:profile/labels', function(context) {
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					// NOTE: This needs all tree data, so we wait for the tree promise first
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return LabelDefinitions.getInstance().load();
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading labels: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// Version of a note
			this.get('#/:profile/history/:noteId/:versionName', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				var versionName = this.params['versionName'];
				if (!versionName) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return HistoryActions.getInstance().requestVersion(noteId, versionName);
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading version: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Version history of a note
			this.get('#/:profile/history/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return HistoryActions.getInstance().showHistory(noteId);
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading history: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// References to a note
			this.get('#/:profile/refs/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						Refs.getInstance().load(noteId);
					});
				})
				.catch(function(err) {
					that.app.showAlert('Error loading references: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Conflict of a note
			this.get('#/:profile/c/:noteId/:revId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				var revId = this.params['revId'];
				if (!revId) {
					that.app.showAlert('No revision received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					return DocumentActions.getInstance().requestConflict(noteId, revId);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading conflict: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Label definitions of an item
			this.get('#/:profile/ld/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				// NOTE: This needs the parents and label definitions of the whole tree.
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.resolve(data.treePromise);
				})
				.then(function(data) {
					that.app.resetPage();
					return LabelActions.getInstance().requestLabelDefinitions(noteId);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading labels: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Raw JSON view for an item
			this.get('#/:profile/raw/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				
				that.app.startApp(this.params['profile'])
				.then(function(data) {
					that.app.resetPage();
					return DocumentActions.getInstance().requestRawView(noteId);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading raw JSOn view: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Item
			function openDocument(context, params, noteId) {
				return that.app.startApp(params['profile'])
				.then(function(data) {
					that.app.resetPage();
					
					var doc = Document.getTargetDoc(that.app.getData() ? that.app.getData().getById(noteId) : null);
					if (Database.getInstance().profileHandler.getCurrentProfile().clone && doc) {
						// If the data is already there, use it
						return EditorActions.getInstance().requestEditor(doc)
						.then(function() {
							return Promise.resolve({
								ok: true,
								startAppData: data
							})
						});
					} else {
						// If the data is not yet there or we are not in clone mode, load it from DB
						return DocumentActions.getInstance().request(noteId)
						.then(function() {
							return Promise.resolve({
								ok: true,
								startAppData: data
							})
						});
					}
				});
			}
			this.get('#/:profile/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}

				openDocument(context, this.params, noteId)
				.then(function(data) {
					if (!data || !data.ok) return Promise.reject({
						message: 'Error in Routing.opeDocument()' + (data && data.message) ? (': ' + data.message) : ''
					});
					return Promise.resolve(data.startAppData.treePromise);
				})
				.then(function() {
					NoteTree.getInstance().setSearchText();
					NoteTree.getInstance().editorOpened(noteId);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading note: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Item with search text predefined
			this.get('#/:profile/:noteId/search/:token', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.app.showAlert('No ID received', 'E');
					return;
				}
				var token = this.params['token'];
				
				openDocument(context, this.params, noteId)
				.then(function(data) {
					if (!data || !data.ok) return Promise.reject({
						message: 'Error in Routing.opeDocument()' + (data && data.message) ? (': ' + data.message) : ''
					});
					return Promise.resolve(data.startAppData.treePromise);
				})
				.then(function() {
					if (token) NoteTree.getInstance().setSearchText(token);
				})
				.catch(function(err) {
					that.app.showAlert('Error loading note: ' + err.message, 'E', err.messageThreadId);
				});
			});
		});
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Start routing
	 */
	run() {
		this.sammy.run('#/');
	}
	
	/**
	 * Refresh current path
	 */
	refresh() {
		this.sammy.refresh();
	}
	
	/**
	 * Calls the profile selection screen
	 */
	callSelectProfile() {
		ClientState.getInstance().setLastOpenedUrl();
		location.href = '#/notebooks';
	}
	
	/**
	 * Calls a route
	 */
	call(path, profileUrl) {
		if (profileUrl) {
			NoteTree.getInstance().resetFavoriteBuffers();
		}
		
		var url = this.getBasePath(profileUrl) + (path ? path : '');
		if (location.href == url) {
			this.app.refresh();
		} else {
			location.href = url;
		}
	}
	
	/**
	 * Sets the serach text to the token after page load. Optionally, you can pass 
	 * a document ID to be opened, else the profile root is loaded.
	 */
	callSearch(token, id) {
		if (!token) {
			this.call(id);
			return;
		}
		
		this.call((id ? (id + '/') : '') + 'search/' + token);
	}
	
	/**
	 * Calls the profile root with the selected parent ID.
	 */
	callProfileRootWithSelectedId(id) {
		this.call('select/' + (id ? id : ''));
	}
	
	/**
	 * Returns the profile base path
	 */
	getBasePath(profileUrl, routeOnly) {
		var profile = Database.getInstance().profileHandler.exportProfile(profileUrl, true);
		if (!profile && profileUrl) {
			// New profile: Encode
			profile = Database.getInstance().profileHandler.encodeProfile({
				url: profileUrl
			});
		}
		if (routeOnly) {
			return '#/' + profile + '/';			
		} else {
			return location.protocol +'//'+ location.host + (location.pathname ? location.pathname : '') + '#/' + profile + '/';
		}
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Call a conflict
	 */
	callConflict(id, rev) {
		this.call('c/' + id + '/' + rev);
	}
	
	/**
	 * Calls the conflicts page
	 */
	callConflicts() {
		this.call("conflicts");
	}
	
	/**
	 * Calls the docs page
	 */
	callDocumentation() {
		location.href = '#/doc/overview';
	}
	
	/**
	 * Calls the update page
	 */
	callUpdatePage() {
		location.href = '#/update';
	}
	
	/**
	 * Calls the raw JSON view
	 */
	callRawView(id) {
		this.call('raw/' + id);
	}
	
	/**
	 * Call labels list of an item
	 */
	callLabelDefinitions(id) {
		if (!id) {
			this.call('labels');
		} else {
			this.call('ld/' + id);
		}
	}
	
	/**
	 * Call hashtags overview
	 */
	callHashtags(id) {
		this.call('tags' + (id ? ('/' + id) : ''));
	}
	
	/**
	 * Calls settings
	 */
	callSettings() {
		this.call("settings");
	}
	
	/**
	 * Calls the console
	 */
	callConsole() {
		location.href = '#/console';
	}
	
	/**
	 * Calls the console
	 */
	callTrash() {
		this.call("trash");
	}
	
	/**
	 * Call graph view.
	 */
	callGraphView() {
		this.call("graph");
	}
	
	/**
	 * Calls the about dialog.
	 */
	callAbout() {
		//alert("Notes Version " + this.app.appVersion + "\n\n(C) 2021 Thomas Weber (tom-vibrant[at]gmx.de)\nLicense: GPL v3");
		this.callUpdatePage();
	}
}