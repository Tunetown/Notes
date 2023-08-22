/**
 * Shows and stores settings
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
class Settings {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Settings.instance) Settings.instance = new Settings();
		return Settings.instance;
	}
	
	static settingsDocId = 'settings';
	
	constructor() {
		this.settings = this.getDefaults();
		this.nextSectionId = 1;
	}
	
	/**
	 * Default settings object
	 */
	getDefaults() {
		return {
			// Theme colors
			mainColor: Config.defaultThemeColor,
			textColor: Config.defaultTextColor,

			// Database options
			autoSaveIntervalSecs: Config.defaultAutosaveIntervalSecs,
			dbAccountName: Config.defaultNotebookName, //Database.getInstance().profileHandler.getCurrentProfile().url,

			// Editor settings
			defaultNoteEditor: Config.defaultEditorMode,
			defaultCodeLanguage: Config.defaultPlainTextMode,

			// Div. options
			askBeforeMoving: Config.defaultAskBeforeMoving,
			maxUploadSizeMB: Config.defaultMaxUploadSizeMB,
			reduceHistory: Config.defaultReduceHistory,
			maxSearchResults: Config.defaultMaxSearchResults,
			showAttachedImageAsItemBackground: Config.defaultShowAttachedImageAsItemBackground,
		};
	}
	
	/**
	 * Check the passed settings object. Returns the number of settings properties checked.
	 */
	checkSettings(settings, errors) {
		var defs = this.getDefaults();
		
		var cnt = 0;
		for (var p in defs) {
			if (!defs.hasOwnProperty(p)) continue;
			if ((p == 'defaultCodeLanguage') && (settings.defaultNoteEditor != 'code')) continue;

			cnt++;
			if (!settings.hasOwnProperty(p)) {
				errors.push({
					message: "Property missing: " + p,
					id: 'settings',
					type: 'E'
				});
			}
		}
		
		this.checkNumeric(settings, 'autoSaveIntervalSecs', errors);
		this.checkNumeric(settings, 'maxUploadSizeMB', errors);
		this.checkNumeric(settings, 'maxSearchResults', errors);
		
		if (!Document.isValidEditorMode(settings.defaultNoteEditor)) {
			errors.push({
				message: 'Invalid editor mode: ' + settings.defaultNoteEditor,
				id: 'settings',
				type: 'E'
			});		
		}
		if (settings.defaultNoteEditor == 'code') {
			if (!Code.isValidEditorLanguage(settings.defaultCodeLanguage)) {
				errors.push({
					message: 'Invalid code editor language: ' + settings.defaultCodeLanguage,
					id: 'settings',
					type: 'E'
				});		
			}
		}
		
		var ok = errors.length == 0; 
		if (ok) {
			errors.push({
				message: 'All ' + cnt + ' settings found and checked OK',
				id: 'settings',
				type: 'S'
			});
		}
		
		return {
			numPropsChecked: cnt,
			ok: ok
		};
	}
	
	/**
	 * Helper for checkSettings()
	 */
	checkNumeric(settings, propName, errors) {
		if (!settings.hasOwnProperty(propName)) return;  // This has been checked before
		
		if (!Tools.isNumber(settings[propName])) {
			errors.push({
				message: "Property is not a number: " + propName + " = " + settings[propName],
				id: 'settings',
				type: 'E'
			});
		}
	}
	
	#addSection(title, rows, collapsed) {
		var secId = this.nextSectionId ++;
				
		for(var r in rows) {
			rows[r].data('sectionid', secId);
			if (collapsed) rows[r].hide();
		}
		
		var that = this;
		this.table.append(
			$('<tr class="bg-primary" data-sectionidhdr="' + secId + '"/>').append(
				[
					$('<th class="settingsHdCol" colspan="3" scope="col"><span class="settingsCollapseIcon fa fa-chevron-' + (collapsed ? 'right' : 'down') + '"></span>' + title + '</th>'),
				]
			)
			.on('click', function(e) {
				e.stopPropagation();
				
				// Open/close section
				var hdrId = $(this).data('sectionidhdr');
				
				var opened = false;				
				that.table.find('tr').each(function() {
					if ($(this).data('sectionid') == hdrId) {
						if ($(this).is(":visible")) {
							$(this).hide();
							opened = false;
						} else {
							$(this).show();
							opened = true;
						}
					} 
				});
				
				const collIcon = $(this).find('.settingsCollapseIcon');
				collIcon.toggleClass('fa-chevron-right', !opened);
				collIcon.toggleClass('fa-chevron-down', opened);

			}),
			rows
		);
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		var d = Database.getInstance();
		
		//Database.getInstance().setAutoLoginBlock(true);
		
		// Set page name in the header
		n.setStatusText("Settings"); 
		
		var rows = this.#setupRows();

		// Build settings page
		//var that = this;
		this.table = $('<tbody>');
		
		$('#contentContainer').append(
			$('<table class="table settingsForm"/>').append(
				this.table
			)
		);
		
		this.#addSection('Remote Connection', rows.rowsRemoteConnection);		
		this.#addSection('Remote Sync', rows.rowsRemoteSync);
		this.#addSection('Notebook Settings', rows.rowsNotebookSettings, true);
		this.#addSection('Local Device Settings', rows.rowsLocalDeviceSettings, true);
		this.#addSection('Navigation Settings', rows.rowsNavigationSettings, true);
		this.#addSection('Import/Export of the whole database', rows.rowsImportExport, true);
		this.#addSection('Debugging Options', rows.rowsDebugging, true);
		this.#addSection('Experimental Features', rows.rowsExperimentalFeatures, true);
		
		this.table.append(
			$('<br>'),
			$('<br>'),
			$('<br>'),	
		);
		
		// Check DB status
		d.checkRemoteConnection().then(function(data) {
			$('#dbcheck').html(data.message);
			
			$('#dbAdminLink').empty();
			$('#dbAdminLink').append(
				$('<a href="' + Database.getInstance().getAdminLink() + '" target="_blank">Administrate...</a>')
			);
		}).catch(function(err) {
			$('#dbcheck').html('Error: ' + err.message);
			$('#dbAdminLink').empty();
		});
		
		// Check login status
		d.checkRemoteLogin().then(function(data) {
			$('#loginCheck').html(data.message);
			
			if (data.ok) {
				$('#loginSettingsButton').hide();
				$('#logoutSettingsButton').show();
			} else {
				$('#loginSettingsButton').show();
				$('#logoutSettingsButton').hide();
			}
		}).catch(function(err) {
			$('#loginCheck').html('Error: ' + err.message);
			$('#loginSettingsButton').show();
			$('#logoutSettingsButton').hide();
		});
		
		// Trust check
		const trusted = ClientState.getInstance().isDeviceTrusted();
		$('#trustCheck').html(trusted ? 'Device is trusted' : '');		
		if (trusted) {
			$('#settingsTrustRow').show();
		} else {
			$('#settingsTrustRow').hide();
		}
		
		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Save Settings" class="fa fa-save" onclick="event.stopPropagation();Settings.getInstance().saveSettings()"></div>'),
		]);
	}
	
	/**
	 * Export all documents as internal JSON
	 */
	exportAll(format) {
		if (!format) {
			Notes.getInstance().showAlert("No format specified", "E");
			return;
		}
		
		// Raw json export
		if (format == 'json') {
			if (!confirm('Export all documents including settings and metadata?')) return;

			(new NotesExporter()).exportDatabase()
			.then(function(data) {
				Notes.getInstance().showAlert('Exported ' + ((data && data.docs) ? data.docs.length : "[unknown]") + ' documents.', 'S');
			})
			.catch(function(err) {
				Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
			});
		}
		
		// Obsidian export
		if (format == 'files') {
			var children = Notes.getInstance().getData().getChildren("", true);
			
			if (!confirm('Export all ' + children.length + ' documents?')) return;
			
			var ids = [];
			for(var d in children) {
				ids.push(children[d]._id);
			}

			ObsidianExporter.getInstance().export(ids)
			.then(function(/*data*/) {
				Notes.getInstance().showAlert('Exported ' + children.length + ' documents.', 'S');
			})
			.catch(function(err) {
				Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
			});
		}
	}
	
	/**
	 * Removes the database name from an url.
	 */
	getDatabaseUrlProposal(url) {
		if (url == 'local') return '';
		
		return url.split('/').slice(0, -1).join('/') + '/';
	}
	
	/**
	 * Save settings
	 */
	saveSettings() {
		SettingsActions.getInstance().saveSettings()
		.then(function(data) {
			if (data.message) Notes.getInstance().showAlert(data.message, 'S', data.messageThreadId);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert('Error saving settings: ' + err.message, 'E', err.messageThreadId);
		})
	}
	
	/**
	 * Apply current settings to the application
	 */
	apply() {
		var n = Notes.getInstance();
		var t = NoteTree.getInstance();
		
		n.setMainColor(this.settings.mainColor);
		n.setTextColor(this.settings.textColor);
		n.updateDimensions();
		
		t.updateFavorites();
	}
	
	/**
	 * Set new settings.
	 */
	set(data) {
		if (!data || (Object.keys(data).length === 0)) return;
		
		this.settings = data;
		this.apply();
	}
	
	/**
	 * Returns the settings as object.
	 */
	get() {
		return this.settings;
	}
	
	/**
	 * Setup of all rows needed
	 */
	#setupRows() {
		var n = Notes.getInstance();
		var d = Database.getInstance();
		var that = this;
		
		// Build list of available remotes
		var remoteList = [];
		var profiles = d.profileHandler.getProfiles();
		var currentP = d.profileHandler.getCurrentProfile().url;
		for(var p in profiles) {
			remoteList.push($('<option value="' + profiles[p].url + '" ' + ((profiles[p].url == currentP) ? 'selected' : '') + '>' + Tools.getBasename(profiles[p].url) + '</option>'));
		}

		var ret = {};
		ret.rowsRemoteConnection = [
			$('<tr/>').append(
				$('<td class="w-auto">Selected Notebook</td>'),
				$('<td colspan="2"/>').append(
					$('<select class="settings-button" id="cdbEndpointSelect"></select>')
					.append(remoteList)
					.on('change', function(event) {
						var url = this.value;
						
						Database.getInstance().reset();
	
						console.log('Switching to notebook at ' + url);
	
						Notes.getInstance().routing.call('settings', url);
					}),
					$('<br>'),
					$('<br>'),
					$('<div id="dbcheck">Database Status</div>'),
					$('<div id="dbAdminLink"></div>'),
					$('<br>'),
					
					$('<span id="dbUrl"><b>URL:</b> ' + d.profileHandler.getCurrentProfile().url + '</span>'),
					$('<a style="cursor: pointer; padding-left: 10px;">Copy</a>')
					.on('click', function(event) {
						navigator.clipboard.writeText(d.profileHandler.getCurrentProfile().url);
						n.showAlert('Copied URL to Clipboard', 'I');
					})
				)
			),
			$('<tr/>').append(
				$('<td class="w-auto">Authentication</td>'),
				$('<td colspan="2"/>').append([
					$('<button class="btn btn-secondary settings-button" id="loginSettingsButton">Login</button>')
					.on('click', function() {
						Database.getInstance().login()
						.then(function(data) {
							Notes.getInstance().routing.call('settings');
						});
					}),
					
					$('<button class="btn btn-secondary settings-button" id="logoutSettingsButton">Logout</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						Database.getInstance().logout()
						.then(function(data) {
							if (!data.ok) {
								Notes.getInstance().showAlert(data.message, 'E', data.messageThreadId);
								return;
							}
							Database.getInstance().reset();
							Notes.getInstance().routing.call('settings');
						})
						.catch(function(err) {
							Notes.getInstance().showAlert(err.message, 'E', err.messageThreadId);
						});
					}),
					
					$('<span id="loginCheck"/>'),
					
					$('<div id="settingsTrustRow"/>').append(
						$('<button class="btn btn-secondary settings-button" id="untrustSettingsButton">Untrust</button>')
						.on('click', function(event) {
							event.stopPropagation();
							
							ClientState.getInstance().setTrustedDeviceCredentials();
							
							Notes.getInstance().showAlert("Deleted device credentials.", 'I');
							
							Notes.getInstance().routing.call('settings');
						}), 
						
						$('<span id="trustCheck"/>'),							
					)
				])
			),	
			
			$('<tr/>').append(
				$('<td>Options</td>'),
				$('<td colspan="2"/>').append(!d.profileHandler.getCurrentProfile().url ? null : [

					$('<button class="btn btn-secondary settings-button">Open Notebook from CouchDB URL...</button>')
					.on('click', function() {
						var url = prompt('CouchDB Address:', that.getDatabaseUrlProposal(d.profileHandler.getCurrentProfile().url));
						if (!url) return;
						
						Database.getInstance().reset();
						Notes.getInstance().routing.call('', url);
					}),
					
					(d.profileHandler.getCurrentProfile().url == "local") ? null : $('<button class="btn btn-secondary settings-button">Close Notebook...</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						if (!confirm('Really close the notebook at ' + Database.getInstance().profileHandler.getCurrentProfile().url + '? This will only delete local data, the remote database is not being touched.')) {
							return;
						}
						Database.getInstance().profileHandler.deleteProfile();
						Database.getInstance().reset();
						Notes.getInstance().routing.call('settings');
					}),
					
					!d.profileHandler.getCurrentProfile().clone ? null : $('<br>'),
					
					!d.profileHandler.getCurrentProfile().clone ? null : $('<button class="btn btn-secondary settings-button">Replicate Notebook to URL</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var url = prompt('URL to replicate to: ');
						if (!url) return;
						
						Notes.getInstance().routing.callConsole();
						Database.getInstance().replicateLocalTo(url)
						.catch(function(err) {
							Notes.getInstance().showAlert("Error replicating to " + url);
							
							Console.log("Error replicating to " + url + ":", 'E');
							Console.log(err);
						});
					}),
					
					/*
					!d.profileHandler.getCurrentProfile().clone ? null : $('<button class="btn btn-secondary settings-button">Replicate Notebook to URL</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var url = prompt('URL to replicate to: ');
						if (!url) return;
						
						Notes.getInstance().routing.callConsole();
						Database.getInstance().replicateLocalTo(url)
						.catch(function(err) {
							Notes.getInstance().showAlert("Error replicating to " + url);
							
							Console.log("Error replicating to " + url + ":", 'E');
							Console.log(err);
						});
					}),
					*/
					//$('<br>'),
					//$('<textarea readonly id="dbLink">' + Notes.getInstance().routing.getBasePath() + '</textarea>'),
				])
			),	
		];
		
		/////////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////////
		
		ret.rowsRemoteSync = [
			$('<tr/>').append(
				$('<td class="w-auto">Make available offline</td>'),
				$('<td/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (d.profileHandler.getCurrentProfile().clone ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  !d.profileHandler.profileCanClone(),
								onChange: function() {
									var p = Database.getInstance().profileHandler.getCurrentProfile();
									p.clone = !!this.getChecked();
									Database.getInstance().profileHandler.saveProfile(p);
									
									Database.getInstance().reset();
									Notes.getInstance().routing.call('settings');
								}
							});
						}, 0);
					})
				),
				$('<td/>')
			),	
			$('<tr/>').append(
				$('<td class="w-auto">Auto sync to server</td>'),
				$('<td/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (d.profileHandler.getCurrentProfile().autoSync ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  !d.profileHandler.profileCanAutoSync(),
								onChange: function() {
									var p = Database.getInstance().profileHandler.getCurrentProfile();
									p.autoSync = !!this.getChecked();
									Database.getInstance().profileHandler.saveProfile(p);
									
									Database.getInstance().reset();
									Notes.getInstance().routing.call('settings');
								}
							});
						}, 0);
					})
				),
				$('<td/>')
			)
		];
		
		/////////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////////
		
		ret.rowsNotebookSettings = [
			$('<tr/>').append(
				$('<td class="w-auto">Notebook Name</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.settings.dbAccountName + '" />')
					.on('change', function() {
						var s = Settings.getInstance();
						s.settings.dbAccountName = this.value;
						that.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Background Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + this.settings.mainColor + '"/>')
					.on('change', function() {
						var s = Settings.getInstance();
						s.settings.mainColor = this.value;
						s.apply();
					})
					.on('input', function() {
						var s = Settings.getInstance();
						s.settings.mainColor = this.value;
						s.apply();
					})
					.on('blur', function() {
						that.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Text Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + this.settings.textColor + '"/>')
					.on('change', function() {
						var s = Settings.getInstance();
						s.settings.textColor = this.value;
						s.apply();
					})
					.on('input', function() {
						var s = Settings.getInstance();
						s.settings.textColor = this.value;
						s.apply();
					})
					.on('blur', function() {
						that.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Editor Defaults</td>'),
				$('<td colspan="2"/>').append(
					Document.getEditorModeSelector(this.settings.defaultNoteEditor ? this.settings.defaultNoteEditor : 'richtext', {
						hideKanban: true,
						cssClass: 'settingsSelect'
					})
					.on('change', function(event) {
						var s = Settings.getInstance();
						
						s.settings.defaultNoteEditor = this.value;
						that.saveSettings();
						
						Notes.getInstance().routing.call('settings');
					}),
					
					!(this.settings.defaultNoteEditor && this.settings.defaultNoteEditor == 'code') ? null : 
					Code.getInstance().getLanguageSelector(this.settings.defaultCodeLanguage ? this.settings.defaultCodeLanguage : 'markdown')
					.on('change', function(event) {
						var s = Settings.getInstance();
						
						s.settings.defaultCodeLanguage = this.value;
						that.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Auto Save Interval</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.settings.autoSaveIntervalSecs + '" />')
					.on('change', function() {
						var s = Settings.getInstance();
						this.value = parseFloat(this.value) ? parseFloat(this.value) : 0;
						if (this.value < 0) {
							this.value = 0;
						}									
						
						s.settings.autoSaveIntervalSecs = parseFloat(this.value);
						that.saveSettings();
					}),
					$('<span class="settings-explanation">Seconds (Zero to disable)</span>')
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Ask before Moving</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.settings.askBeforeMoving ? "checked" : "") + '/>')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = Settings.getInstance();
									s.settings.askBeforeMoving = this.getChecked();
									s.saveSettings();
								}
							});
						}, 0);
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Reduce History at Save</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.settings.reduceHistory ? "checked" : "") + '/>')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = Settings.getInstance();
									s.settings.reduceHistory = this.getChecked();
									s.saveSettings();
								}
							});
						}, 0);
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. upload file size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + parseFloat(this.settings.maxUploadSizeMB) + '" />')
					.on('change', function() {
						var val = parseFloat(this.value);
						if (!val || val < 0) {
							this.value = 0;
							val = parseFloat(this.value);
						}
						
						that.settings.maxUploadSizeMB = val;
						that.saveSettings();
					}),
					$('<span class="settings-explanation">MB (Zero to disable)</span>')
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. search results</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + parseInt(this.settings.maxSearchResults) + '" />')
					.on('change', function() {
						var val = parseInt(this.value);
						if (!val) {
							this.value = Config.defaultMaxSearchResults;
						} else if (val < 1) {
							this.value = 1;
							val = parseInt(this.value);
						}
						
						that.settings.maxSearchResults = val;
						that.saveSettings();
					}),
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Preview attachment images in navigation</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.settings.showAttachedImageAsItemBackground ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = Settings.getInstance();
									s.settings.showAttachedImageAsItemBackground = !!this.getChecked();
									
									s.saveSettings();
								}
							});
						}, 0);
					})
				),
			)
		];
		
		//////////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////////
		
		ret.rowsLocalDeviceSettings = [
			$('<tr/>').append(
				$('<td class="w-auto">Header Size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + n.getHeaderSize()  + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minHeaderSize || !parseFloat(this.value)) this.value = Config.minHeaderSize;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.headerSizeMobile = parseFloat(this.value);										
						} else {
							g.headerSizeDesktop = parseFloat(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Option Button Size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + n.getRoundedButtonSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minButtonSize || !parseFloat(this.value)) this.value = Config.minButtonSize;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.optionTextSizeMobile = parseFloat(this.value);										
						} else {
							g.optionTextSizeDesktop = parseFloat(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
						
						TreeActions.getInstance().requestTree()
						.catch(function(err) {
							Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Footer Size</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + n.getFooterSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minFooterSize || !parseFloat(this.value)) this.value = Config.minFooterSize;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.footerSizeMobile = parseFloat(this.value);										
						} else {
							g.footerSizeDesktop = parseFloat(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Landing Page: Redirect to last opened</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().isLastOpenedUrlRedirectEnabled() ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									ClientState.getInstance().enableLastOpenedUrlRedirect(!!this.getChecked());
								}
							});
						}, 0);
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Show Favorites</td>'),
				$('<td colspan="2"/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (!ClientState.getInstance().getViewSettings().dontShowFavorites ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = ClientState.getInstance().getViewSettings();
									cs.dontShowFavorites = !this.getChecked();
									ClientState.getInstance().saveViewSettings(cs);
									
									NoteTree.getInstance().resetFavoriteBuffers();
									NoteTree.getInstance().refresh();
								}
							});
						}, 0);
					}),
					
					$('<span style="margin-left: 5px" ></span>').html('Uses ' + JSON.stringify(ClientState.getInstance().getFavorites()).length + " bytes of local memory, "),
					
					$('<a style="margin-left: 5px" href="javascript:void(0);">Clear...</a>')
					.on('click', function(event) {
						event.stopPropagation();
						
						NoteTree.getInstance().resetFavoriteBuffers();
						Notes.getInstance().clearFavorites();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Favorites Size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + (ClientState.getInstance().getViewSettings().favoritesSize) + '" />')
					.on('change', function() {
						if (!parseInt(this.value)) this.value = Config.defaultFavoritesSize;
						if (parseInt(this.value) < Config.minFavoritesSize) this.value = Config.minFavoritesSize;
						
						var cs = ClientState.getInstance().getViewSettings();
						cs.favoritesSize = parseInt(this.value);
						ClientState.getInstance().saveViewSettings(cs);
						
						NoteTree.getInstance().resetFavoriteBuffers();
						NoteTree.getInstance().refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. Number of Favorites</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + (ClientState.getInstance().getViewSettings().favoritesNum) + '" />')
					.on('change', function() {
						if (!parseInt(this.value)) this.value = Config.defaultFavoritesAmount;
						if (parseInt(this.value) < 1) this.value = 1;
						
						var cs = ClientState.getInstance().getViewSettings();
						cs.favoritesNum = parseInt(this.value);
						ClientState.getInstance().saveViewSettings(cs);
						
						NoteTree.getInstance().resetFavoriteBuffers();
						NoteTree.getInstance().refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Show current Document in Favorites</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().getViewSettings().dontShowCurrentInFavorites ? '' : 'checked') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = ClientState.getInstance().getViewSettings();
									cs.dontShowCurrentInFavorites = !this.getChecked();
									ClientState.getInstance().saveViewSettings(cs);
									
									NoteTree.getInstance().resetFavoriteBuffers();
									NoteTree.getInstance().refresh();
								}
							});
						}, 0);
					})
				)
			),	
		];
		
		////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////
		
		ret.rowsNavigationSettings = [
			n.isMobile() ? null : $('<tr/>').append(
				$('<td class="w-auto">Navigation Width</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + NoteTree.getInstance().getContainerWidth() + '" />')
					.on('change', function() {
						if (!parseFloat(this.value)) this.value = "";
						if (parseFloat(this.value) < 0) this.value = "";
						
						if (Notes.getInstance().isMobile()) return;
						NoteTree.getInstance().setContainerWidth(parseInt(this.value));
						ClientState.getInstance().saveTreeState();
						NoteTree.getInstance().refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Text Size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + NoteTree.getInstance().getTreeTextSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minNavigationTextSize || !parseFloat(this.value)) this.value = Config.minNavigationTextSize;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.navTextSizeMobile = parseFloat(this.value);										
						} else {
							g.navTextSizeDesktop = parseFloat(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
						
						TreeActions.getInstance().requestTree()
						.catch(function(err) {
							Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Item Size</td>'),
				$('<td/>').append(
					$('<input type="text" value="' + DetailBehaviour.getItemHeight() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minDetailNavigationItemHeight || !parseFloat(this.value)) this.value = Config.minDetailNavigationItemHeight;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.detailItemHeightMobile = parseFloat(this.value);										
						} else {
							g.detailItemHeightDesktop = parseFloat(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
						
						TreeActions.getInstance().requestTree()
						.catch(function(err) {
							Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Animation Time</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + MuuriGrid.getAnimationDuration() + '" />')
					.on('change', function() {
						if (parseInt(this.value) < Config.minDetailNavigationAnimationDuration || !parseInt(this.value)) this.value = Config.minDetailNavigationAnimationDuration;
						
						var g = ClientState.getInstance().getLocalSettings();
						if (n.isMobile()) {
							g.navigationAnimationDurationMobile = parseInt(this.value);										
						} else {
							g.navigationAnimationDurationDesktop = parseInt(this.value);
						}
						ClientState.getInstance().setLocalSettings(g);
						
						n.update();
						
						TreeActions.getInstance().requestTree()
						.catch(function(err) {
							Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Navigation Mode</td>'),
				$('<td colspan="2" />').append(
					Behaviours.getModeSelector('settingsTreeModeSelectorList', ClientState.getInstance().getViewSettings().navMode)
					.on('change', function(event) {
						n.hideOptions();
						
						var s = ClientState.getInstance().getViewSettings();
						s.navMode = this.value;
						ClientState.getInstance().saveViewSettings(s);

						//NoteTree.getInstance().refresh();
						n.routing.callSettings();
					})
				)
			)
		];
		
		var navRows = NoteTree.getInstance().getSettingsPanelContentTableRows('Ref Mode: Show ');
		for(var nr in navRows) {
			var navRow = navRows[nr];
			ret.rowsNavigationSettings.push(navRow);
		}
		
		/////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////
		
		ret.rowsImportExport = [
			$('<tr/>').append(
				$('<td colspan="3"/>').append([
					$('<button class="btn btn-secondary settings-button">Export Raw Data (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						that.exportAll('json');									
					}),
					
					$('<button class="btn btn-secondary settings-button">Import Raw Data (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						new Import(new NotesImporter({
							importInternal: true,
							createIds: true,
							useRootItem: false,
						})).startFileImport();
					}),
					
					$('<button class="btn btn-secondary settings-button">Verify Raw Data (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().routing.callVerifyBackup();
					}),
				])
			),	
		];
		
		/////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////
		/////////////////////////////////////////////////////////////////////////////////////
		
		ret.rowsDebugging = [
			$('<tr/>').append(
				$('<td class="w-auto">Persistent Console logs</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().getConsoleSettings().persist ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = ClientState.getInstance().getConsoleSettings();
									s.persist = !!this.getChecked();
									ClientState.getInstance().saveConsoleSettings(s);
									
									Console.getInstance().clear();
									Notes.getInstance().showAlert('Cleared console logs.', 'I');
								}
							});
						}, 0);
					}),

					$('<a style="cursor: pointer; padding-left: 10px;">Open Console</a>')
					.on('click', function(event) {
						Notes.getInstance().routing.callConsole();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Override View Mode</td>'),
				$('<td colspan="2" />').append(
					$('<select></select>').append([
						$('<option value="off">Off</option>'),
						$('<option value="desktop">Desktop</option>'),
						$('<option value="mobile">Mobile</option>'),
					])
					.each(function(i) {
						var mode = ClientState.getInstance().getMobileOverride();
						if (!mode) mode = "off";
						$(this).val(mode);
						
						$(this).on('change', function(event) {
							ClientState.getInstance().setMobileOverride($(this).val())
							location.reload();
						});
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Rich Text Editor: Auto-Format links</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().getEditorSettings().dontReplaceLinksInRTEditor ? '' : 'checked') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = ClientState.getInstance().getEditorSettings();
									cs.dontReplaceLinksInRTEditor = !this.getChecked();
									ClientState.getInstance().saveEditorSettings(cs);
								}
							});
						}, 0);
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Rich Text Editor: Auto-Format hashtags</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().getEditorSettings().dontReplaceTagsInRTEditor ? '' : 'checked') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = ClientState.getInstance().getEditorSettings();
									cs.dontReplaceTagsInRTEditor = !this.getChecked();
									ClientState.getInstance().saveEditorSettings(cs);
								}
							});
						}, 0);
					})
				)
			),
			
			$('<tr/>').append(
				$('<td/>').text('Data Options'),
				$('<td colspan="2"/>').append(!d.profileHandler.getCurrentProfile().url ? null : [

					// Check page
					$('<button class="btn btn-secondary settings-button">Check Consistency</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						Notes.getInstance().routing.call('check');
					}),
					
					// Clear local data
					$('<button class="btn btn-secondary settings-button">Clear Local Data</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						if (!confirm("Really delete the local database?")) {
							return;
						}
						
						var prom = Database.getInstance().clearLocalDatabase();
						if (!prom) {
							Notes.getInstance().showAlert('Could not delete database.', 'E');
							return;
						}
						prom.then(function(data) {
							Notes.getInstance().showAlert('Local database is now empty.', 'S');
							Database.getInstance().reset();
							Notes.getInstance().routing.call('settings');
						}).catch(function(err) {
							Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
						});
					}),
					
					// Generate documents
					$('<button class="btn btn-secondary settings-button">Generate Random Documents</button>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().routing.call('generate');
					}),
				]),
			),						
			$('<tr/>').append(
				$('<td/>').text('Internal Documents'),
				$('<td colspan="2"/>').append([
					// Edit raw settings document
					$('<button class="btn btn-secondary settings-button">Edit Settings Document</button>')
					.on('click', function(event) {
						event.stopPropagation();
						n.routing.callRawView(Settings.settingsDocId);
					}),
					
					// Edit global-meta document
					$('<button class="btn btn-secondary settings-button">Edit Global Metadata Document</button>')
					.on('click', function(event) {
						event.stopPropagation();
						n.routing.callRawView(MetaActions.metaDocId);
					}),

				])
			),	
		];
		
		//////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////
		
		ret.rowsExperimentalFeatures = [
			$('<tr/>').append(
				$('<td class="w-auto">Enable Graph Page</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().experimentalFunctionEnabled(GraphView.experimentalFunctionId) ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									ClientState.getInstance().enableExperimentalFunction(GraphView.experimentalFunctionId, !!this.getChecked());
									Notes.getInstance().update();
								}
							});
						}, 0);
					})
				)
			),
			
			/*$('<tr/>').append(
				$('<td class="w-auto">Enable Undo/Redo</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (ClientState.getInstance().experimentalFunctionEnabled(UndoManager.experimentalFunctionId) ? 'checked' : '') + ' />')
					.each(function(i) {
						var that = this;
						setTimeout(function() {
							new Switch(that, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									ClientState.getInstance().enableExperimentalFunction(UndoManager.experimentalFunctionId, !!this.getChecked());
									Notes.getInstance().update();
								}
							});
						}, 0);
					})
				)
			),*/
			
			/*$('<tr/>').append(
				$('<td class="w-auto">Import from Trello</td>'),
				$('<td colspan="2"/>').append([
					$('<button class="btn btn-secondary settings-button">Import Board from Trello (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						new Import(new TrelloImporter()).startFileImport();
					}),
				])
			),*/
				
			$('<tr/>').append(
				$('<td colspan="3"/>').append([
					$('<button class="btn btn-secondary settings-button">Export as ZIP of MD files (Obsidian)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						that.exportAll('files');
					}),
				])
			),	
		];
		
		return ret;
	}
}