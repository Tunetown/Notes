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
	
	constructor() {
		this.settings = this.getDefaults();
	}
	
	/**
	 * Default settings object
	 */
	getDefaults() {
		return {
			// Theme colors
			mainColor: "#ff8080",
			textColor: "#06feab",
			
			// Header size
			headerSizeDesktop: 45,
			headerSizeMobile: 35,

			// Tree text sizes
			treeTextSizeDesktop: 18,
			treeTextSizeMobile: 22,
			
			// Tile text sizes
			tileTextSizeDesktop: 18,
			tileTextSizeMobile: 18,
			
			// Option button sizes
			optionTextSizeDesktop: 18,
			optionTextSizeMobile: 20,
			
			// Database options
			autoSaveIntervalSecs: 3,
			dbAccountName: Database.getInstance().profileHandler.getCurrentProfile().url,

			// Editor settings
			defaultNoteEditor: 'richtext',
			defaultCodeLanguage: 'markdown',

			// Div. options
			askBeforeMoving: false,
			maxUploadSizeMB: 1,
			reduceHistory: true,
			maxSearchResults: 15,
			navigationAnimationDuration: 60,
			showAttachedImageAsItemBackground: true
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
		
		this.checkNumeric(settings, 'headerSizeDesktop', errors);
		this.checkNumeric(settings, 'headerSizeMobile', errors);
		
		this.checkNumeric(settings, 'treeTextSizeDesktop', errors);
		this.checkNumeric(settings, 'treeTextSizeMobile', errors);
		
		this.checkNumeric(settings, 'treeTextSizeDesktop', errors);
		this.checkNumeric(settings, 'treeTextSizeMobile', errors);
		
		this.checkNumeric(settings, 'tileTextSizeDesktop', errors);
		this.checkNumeric(settings, 'tileTextSizeMobile', errors);
		
		this.checkNumeric(settings, 'optionTextSizeDesktop', errors);
		this.checkNumeric(settings, 'optionTextSizeMobile', errors);
		
		this.checkNumeric(settings, 'autoSaveIntervalSecs', errors);
		this.checkNumeric(settings, 'maxUploadSizeMB', errors);
		this.checkNumeric(settings, 'maxSearchResults', errors);
		
		this.checkNumeric(settings, 'navigationAnimationDuration', errors);
		
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
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load() {
		var n = Notes.getInstance();
		var d = Database.getInstance();
		
		// Set note name in the header
		n.setStatusText("Settings"); 
		
		// Build list of available remotes
		var remoteList = [];
		var profiles = d.profileHandler.getProfiles();
		var currentP = d.profileHandler.getCurrentProfile().url;
		remoteList.push($('<option value="new">Add Notebook from CouchDB URL...</option>'));
		for(var p in profiles) {
			remoteList.push($('<option value="' + profiles[p].url + '" ' + ((profiles[p].url == currentP) ? 'selected' : '') + '>' + Tools.getBasename(profiles[p].url) + '</option>'));
		}

		// Build settings page
		var that = this;
		$('#contentContainer').append(
			$('<table class="table settingsForm"/>').append(
				$('<tbody>').append(
					[
						$('<tr class="bg-primary" />').append(
							[
								$('<th class="settingsHdCol" scope="col">Remote Connection</th>'),
								$('<th scope="col"></th>'),
								$('<th scope="col"></th>'),
							]
						),
						$('<tr/>').append(
							$('<td class="w-auto">Remote <a href="https://couchdb.apache.org/" target="_blank">CouchDB</a> Database</td>'),
							$('<td colspan="2"/>').append(
								$('<select class="settings-button" id="cdbEndpointSelect"></select>')
								.append(remoteList)
								.on('change', function(event) {
									var url = this.value;
									if (url == "new") {
										url = prompt("URL to the CouchDB database: ", "https://");
										if (!url || url == "new") return;
									}
									
									Database.getInstance().reset();
									Notes.getInstance().showAlert("Switching profiles, please wait...", 'I');
									Notes.getInstance().routing.call('settings', url);
								}),
								$('<br>'),
								$('<br>'),
								$('<div id="dbcheck">Database Status</div>'),
								$('<div id="dbAdminLink"></div>'),
								$('<br>'),
								$('<div id="dbUrl"><b>URL:</b> ' + d.profileHandler.getCurrentProfile().url + '</div>'),
								!d.profileHandler.getCurrentProfile().clone ? null : $('<div id="dblocalcheck"><b>Local DB name:</b> ' + d.determineLocalDbName() + '</div>')
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
								
								$('<span id="loginCheck"/>') 
							])
						),	
						
						$('<tr/>').append(
							$('<td>Notebook</td>'),
							$('<td colspan="2"/>').append(!d.profileHandler.getCurrentProfile().url ? null : [

								$('<button class="btn btn-secondary settings-button">Open Notebook</button>')
								.on('click', function(event) {
									event.stopPropagation();
									
									var setting = prompt('URL to a notebook:');
									if (!setting) return;
									
									var d = Database.getInstance();
									var n = Notes.getInstance();
									
									try {
										d.profileHandler.importProfile(setting);
										d.get().then(function(data) {
											d.reset();
											n.routing.call('settings');
										}).catch(function(err) {
											d.reset();
											n.routing.call('settings');
										});
						
										n.setStatusText('Opening Notebook');
										
									} catch (e) {
										n.showAlert('Error opening notebook: ' + e);
									}
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
								
								$('<br>'),
								$('<textarea readonly id="dbLink">' + Notes.getInstance().routing.getBasePath() + '</textarea>'),
							])
						),	
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Remote Sync</th>'),
								$('<th scope="col"></th>'),
								$('<th scope="col"></th>'),
							]
						),
						
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
						),	
						$('<tr/>').append(
							$('<td/>'),
							$('<td colspan="2"/>').append(!d.profileHandler.getCurrentProfile().url ? null : [

								$('<button class="btn btn-secondary settings-button">Check Consistency</button>')
								.on('click', function(event) {
									event.stopPropagation();
									
									Notes.getInstance().routing.call('check');
									
									/*Notes.getInstance().routing.call('console');
									Database.getInstance().syncHandler.checkConsistency(function(msg, type) {
										Console.log(msg, type);
									});*/
								}),
								
								$('<button class="btn btn-secondary settings-button">Replicate Local Data to URL</button>')
								.on('click', function(event) {
									event.stopPropagation();
									
									var url = prompt('URL to replicate to: ');
									if (!url) return;
									
									Notes.getInstance().routing.call('console');
									Database.getInstance().replicateLocalTo(url)
									.catch(function(err) {
										Notes.getInstance().showAlert("Error replicating to " + url);
										
										Console.log("Error replicating to " + url + ":", 'E');
										Console.log(err);
									});
								}),

								$('<button class="btn btn-secondary settings-button">Clear Local Data...</button>')
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
							])
						),	

						///////////////////////////////////////////////////////////////////////////////////////////////////
						///////////////////////////////////////////////////////////////////////////////////////////////////
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col" colspan="2">Import/Export of Documents</th>'),
								$('<th scope="col"></th>'),
							]
						),
						$('<tr/>').append(
							$('<td class="w-auto">Internal</td>'),
							$('<td colspan="2"/>').append([
								$('<button class="btn btn-secondary settings-button">Export Raw Data (JSON)</button>')
								.on('click', function(event) {
									event.stopPropagation();
									that.exportAll();
								}),
								$('<button class="btn btn-secondary settings-button">Import Raw Data (JSON)</button>')
								.on('click', function(event) {
									event.stopPropagation();
									new Import(new NotesImporter()).startFileImport();
								}),
							])
						),	
						$('<tr/>').append(
							$('<td class="w-auto">Trello</td>'),
							$('<td colspan="2"/>').append([
								$('<button class="btn btn-secondary settings-button">Import Board from Trello (JSON)</button>')
								.on('click', function(event) {
									event.stopPropagation();
									new Import(new TrelloImporter()).startFileImport();
								}),
							])
						),	
						
						///////////////////////////////////////////////////////////////////////////////////////////////////
						///////////////////////////////////////////////////////////////////////////////////////////////////
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Notebook Settings</th>'),
								$('<th scope="col">Desktop</th>'),
								$('<th scope="col">Mobile</th>'),
							]
						),
						$('<tr/>').append(
							$('<td class="w-auto">Account Name</td>'),
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
							$('<td class="w-auto">Theme Color</td>'),
							$('<td/>').append(
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
							$('<td/>')
						),
						$('<tr/>').append(
							$('<td class="w-auto">Header Text Color</td>'),
							$('<td/>').append(
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
							$('<td/>')
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
									
									s.settings.autoSaveIntervalSecs = parseFloat(this.value);
									that.saveSettings();
								}),
								$('<span class="settings-explanation">Seconds (Zero to disable)</span>')
							),
						),
						$('<tr/>').append(
							$('<td class="w-auto">Ask before Moving</td>'),
							$('<td/>').append(
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
							$('<td/>')
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Reduce History at Save</td>'),
							$('<td/>').append(
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
							$('<td/>')
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Max. upload file size</td>'),
							$('<td colspan="2" />').append(
								$('<input type="text" value="' + parseFloat(this.settings.maxUploadSizeMB) + '" />')
								.on('change', function() {
									var val = parseFloat(this.value);
									if (val < 0) {
										this.value = 5;
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
									if (val < 0) {
										this.value = 20;
										val = parseInt(this.value);
									}
									
									that.settings.maxSearchResults = val;
									that.saveSettings();
								}),
							),
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Button Size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.optionTextSizeDesktop) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.optionTextSizeDesktop = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.optionTextSizeMobile) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.optionTextSizeMobile = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							)
						),
							
						$('<tr/>').append(
							$('<td class="w-auto">Header Size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + this.settings.headerSizeDesktop + '" />')
								.on('change', function() {
									if (parseFloat(this.value) < 20 || !parseFloat(this.value)) this.value = 20;
									
									var s = Settings.getInstance();
									s.settings.headerSizeDesktop = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
								})
							),
							$('<td/>').append(
								$('<input type="text" value="' + this.settings.headerSizeMobile + '" />')
								.on('change', function() {
									if (parseFloat(this.value) < 20 || !parseFloat(this.value)) this.value = 20;
									
									var s = Settings.getInstance();
									s.settings.headerSizeMobile = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
								})
							)
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">List Text Size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.treeTextSizeDesktop) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.treeTextSizeDesktop = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.treeTextSizeMobile) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.treeTextSizeMobile = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							)
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Tile Text Size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.tileTextSizeDesktop) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.tileTextSizeDesktop = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.settings.tileTextSizeMobile) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseFloat(this.value) < 10 || !parseFloat(this.value)) this.value = 10;
									
									s.settings.tileTextSizeMobile = parseFloat(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							)
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Navigation Animation Time</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.settings.navigationAnimationDuration) + '" />')
								.on('change', function() {
									var s = Settings.getInstance();
									if (parseInt(this.value) < 10 || !parseInt(this.value)) this.value = 10;
									
									s.settings.navigationAnimationDuration = parseInt(this.value);
									s.apply();
									
									that.saveSettings();
									
									var a = Actions.getInstance();
									a.requestTree().catch(function(err) {
										Notes.getInstance().showAlert('Error: ' + err.message, 'E', err.messageThreadId);
									});
								})
							)
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Show images in navigation</td>'),
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
						),
							
						///////////////////////////////////////////////////////////////////////////////////////////////////
						///////////////////////////////////////////////////////////////////////////////////////////////////
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Local Device Settings</th>'),
								$('<th scope="col"></th>'),
								$('<th scope="col"></th>'),
							]
						),

						n.isMobile() ? null : $('<tr/>').append(
							$('<td class="w-auto">Navigation Width</td>'),
							$('<td colspan="2" />').append(
								$('<input type="text" value="' + NoteTree.getInstance().getContainerWidth() + '" />')
								.on('change', function() {
									if (!parseFloat(this.value)) this.value = "";
									
									if (Notes.getInstance().isMobile()) return;
									NoteTree.getInstance().setContainerWidth(parseInt(this.value));
									ClientState.getInstance().saveTreeState();
								})
							)
						),

						$('<tr/>').append(
							$('<td class="w-auto">Tile Mode: Max. item size</td>'),
							$('<td colspan="2" />').append(
								$('<input type="text" value="' + (ClientState.getInstance().getViewSettings().tileMaxSize ? ClientState.getInstance().getViewSettings().tileMaxSize : 220) + '" />')
								.on('change', function() {
									var val = parseFloat(this.value);
									var s = ClientState.getInstance().getViewSettings();

									if (!val) {
										this.value = (s.tileMaxSize ? s.tileMaxSize : 220);
										return;
									}
									
									s.tileMaxSize = val;
									ClientState.getInstance().saveViewSettings(s);
									
									Notes.getInstance().routing.call('settings');
								})
							)
						),
						
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
									Notes.getInstance().routing.call('console');
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
												NoteTree.getInstance().refresh();
											}
										});
									}, 0);
								}),
								
								$('<span style="margin-left: 5px" ></span>').html('Uses ' + JSON.stringify(ClientState.getInstance().getFavorites()).length + " bytes of local memory, "),
								
								$('<a style="margin-left: 5px" href="javascript:void(0);">Clear...</a>')
								.on('click', function(event) {
									event.stopPropagation();
									
									Notes.getInstance().clearFavorites();
									
								})
							)
						),
						$('<tr/>').append(
							$('<td class="w-auto">Favorites Size</td>'),
							$('<td colspan="2" />').append(
								$('<input type="text" value="' + (ClientState.getInstance().getViewSettings().favoritesSize ? ClientState.getInstance().getViewSettings().favoritesSize : "70") + '" />')
								.on('change', function() {
									if (!parseInt(this.value)) this.value = "70";
									
									var cs = ClientState.getInstance().getViewSettings();
									cs.favoritesSize = parseInt(this.value);
									ClientState.getInstance().saveViewSettings(cs);
									
									NoteTree.getInstance().refresh();
								})
							)
						),
						$('<tr/>').append(
							$('<td class="w-auto">Number of Favorites</td>'),
							$('<td colspan="2" />').append(
								$('<input type="text" value="' + (ClientState.getInstance().getViewSettings().favoritesNum ? ClientState.getInstance().getViewSettings().favoritesNum : "10") + '" />')
								.on('change', function() {
									if (!parseInt(this.value)) this.value = "10";
									
									var cs = ClientState.getInstance().getViewSettings();
									cs.favoritesNum = parseInt(this.value);
									ClientState.getInstance().saveViewSettings(cs);
									
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
												NoteTree.getInstance().refresh();
											}
										});
									}, 0);
								})
							)
						),
					]
				)
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
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
		
		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Save Settings" class="fa fa-save" onclick="event.stopPropagation();Settings.getInstance().saveSettings()"></div>'),
		]);
	}
	
	/**
	 * Export all documents as internal JSON
	 */
	exportAll() {
		var children = Notes.getInstance().getData().getChildren("", true);
		
		if (!confirm('Export all ' + children.length + ' documents?')) return;
		
		var ids = [];
		for(var d in children) {
			ids.push(children[d]._id);
		}
		
		Actions.getInstance().exportDocuments(ids)
		.then(function(data) {
			Notes.getInstance().showAlert('Exported ' + children.length + ' documents.', 'S');
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Save settings
	 */
	saveSettings() {
		Actions.getInstance().saveSettings()
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
		n.updateHeaderSize();
		
		if (ClientState.getInstance().getViewSettings().navMode == 'tiles') {
			t.setTreeTextSize(n.isMobile() ? this.settings.tileTextSizeMobile : this.settings.tileTextSizeDesktop);
		} else {
			t.setTreeTextSize(n.isMobile() ? this.settings.treeTextSizeMobile : this.settings.treeTextSizeDesktop);
		}
		t.updateFavorites();
		
		n.setRoundedButtonSize(n.isMobile() ? this.settings.optionTextSizeMobile : this.settings.optionTextSizeDesktop);
		
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
}