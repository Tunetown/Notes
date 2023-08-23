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
class SettingsContent {
	
	constructor() {
		this.nextSectionId = 1;
	}
		
	/**
	 * Returns the table element you can add to your app content container.
	 */
	getTable() {
		var d = Database.getInstance();
		
		var currentProfile = d.profileHandler.getCurrentProfile();
		const showSyncOptions = currentProfile ? ((currentProfile.clone && currentProfile.autoSync) || currentProfile.url == "local") : true;
		
		this.table = $('<tbody>');
		
		var content = this.#getContent();
		
		this.#addSection('Select Notebook', content.rowsSelectNotebook);		
		this.#addSection('Remote Connection', content.rowsRemoteConnection, true);		
		this.#addSection('Remote Sync', content.rowsRemoteSync, showSyncOptions);
		this.#addSection('Notebook Settings', content.rowsNotebookSettings, true);
		this.#addSection('Local Device Settings', content.rowsLocalDeviceSettings, true);
		this.#addSection('Navigation Settings', content.rowsNavigationSettings, true);
		this.#addSection('Import/Export of the whole database', content.rowsImportExport, true);
		this.#addSection('Debugging Options', content.rowsDebugging, true);
		this.#addSection('Experimental Features', content.rowsExperimentalFeatures, true);
		
		this.table.append(
			$('<br>'),
			$('<br>'),
			$('<br>'),	
		);

		return $('<table class="table settingsForm"/>').append(
			this.table
		);
	}
	
	/**
	 * Has to be called after the DOM is ready (table has been added)
	 */
	update() {
		var d = Database.getInstance();
		
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
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Adds one section.
	 */
	#addSection(title, rows, collapsed) {
		var secId = this.nextSectionId ++;
				
		for(var r in rows) {
			if (!rows[r]) continue;
			
			rows[r].data('sectionid', secId);
			//if (collapsed) rows[r].hide();
		}
		
		var that = this;
		this.table.append(
			$('<tr class="bg-primary" data-sectionidhdr="' + secId + '"/>').append(
				[
					$('<th class="settingsHdCol" colspan="3" scope="col"><span class="settingsCollapseIcon fa fa-chevron-down"></span>' + title + '</th>'),
				]
			)
			.on('click', function(e) {
				e.stopPropagation();
				
				// Open/close section
				var hdrId = $(this).data('sectionidhdr');
				
				that.#setSectionVisibility(hdrId, !that.#isSectionVisible(hdrId));
			}),
			rows
		);
		
		// The rows have to be hidden after first being added to the DOM, because the switch framework does not 
		// initialize if we add the rows already in hidden state.
		setTimeout(function() {
			that.#setSectionVisibility(secId, !collapsed);			
		}, 0);
	}
	
	#isSectionVisible(sectionId) {
		var ret = false;
		this.table.find('tr').each(function() {
			if ($(this).data('sectionid') == sectionId) {
				ret = $(this).is(":visible");
			} 
		});
		return ret;
	}
	
	#setSectionVisibility(sectionId, shouldBeVisible) {
		this.table.find('tr').each(function() {
			if ($(this).data('sectionid') == sectionId) {
				if (shouldBeVisible) {
					$(this).show();
				} else {
					$(this).hide();
				}
			} 

			if ($(this).data('sectionidhdr') == sectionId) {
				const collIcon = $(this).find('.settingsCollapseIcon');
				collIcon.toggleClass('fa-chevron-right', !shouldBeVisible);
				collIcon.toggleClass('fa-chevron-down', shouldBeVisible);
			}
		});
	}
	
	/**
	 * Setup of all rows needed
	 */
	#getContent() {
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
		ret.rowsSelectNotebook = [
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
			)
		];
		
		////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////////////////
		////////////////////////////////////////////////////////////////////////////////////////////
			
		ret.rowsRemoteConnection = [
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
						var url = prompt('CouchDB Address:', that.#getDatabaseUrlProposal(d.profileHandler.getCurrentProfile().url));
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
					$('<input type="text" value="' + Settings.getInstance().settings.dbAccountName + '" />')
					.on('change', function() {
						var s = Settings.getInstance();
						s.settings.dbAccountName = this.value;
						s.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Background Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + Settings.getInstance().settings.mainColor + '"/>')
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
						var s = Settings.getInstance();
						s.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Text Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + Settings.getInstance().settings.textColor + '"/>')
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
						var s = Settings.getInstance();
						s.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Editor Defaults</td>'),
				$('<td colspan="2"/>').append(
					Document.getEditorModeSelector(Settings.getInstance().settings.defaultNoteEditor ? Settings.getInstance().settings.defaultNoteEditor : 'richtext', {
						hideKanban: true,
						cssClass: 'settingsSelect'
					})
					.on('change', function(event) {
						var s = Settings.getInstance();
						
						s.settings.defaultNoteEditor = this.value;
						s.saveSettings();
						
						Notes.getInstance().routing.call('settings');
					}),
					
					!(Settings.getInstance().settings.defaultNoteEditor && Settings.getInstance().settings.defaultNoteEditor == 'code') ? null : 
					Code.getInstance().getLanguageSelector(Settings.getInstance().settings.defaultCodeLanguage ? Settings.getInstance().settings.defaultCodeLanguage : 'markdown')
					.on('change', function(event) {
						var s = Settings.getInstance();
						
						s.settings.defaultCodeLanguage = this.value;
						s.saveSettings();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Auto Save Interval</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + Settings.getInstance().settings.autoSaveIntervalSecs + '" />')
					.on('change', function() {
						var s = Settings.getInstance();
						this.value = parseFloat(this.value) ? parseFloat(this.value) : 0;
						if (this.value < 0) {
							this.value = 0;
						}									
						
						s.settings.autoSaveIntervalSecs = parseFloat(this.value);
						s.saveSettings();
					}),
					$('<span class="settings-explanation">Seconds (Zero to disable)</span>')
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Ask before Moving</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (Settings.getInstance().settings.askBeforeMoving ? "checked" : "") + '/>')
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
					$('<input class="checkbox-switch" type="checkbox" ' + (Settings.getInstance().settings.reduceHistory ? "checked" : "") + '/>')
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
					$('<input type="text" value="' + parseFloat(Settings.getInstance().settings.maxUploadSizeMB) + '" />')
					.on('change', function() {
						var val = parseFloat(this.value);
						if (!val || val < 0) {
							this.value = 0;
							val = parseFloat(this.value);
						}
						
						var s = Settings.getInstance();
						s.settings.maxUploadSizeMB = val;
						s.saveSettings();
					}),
					$('<span class="settings-explanation">MB (Zero to disable)</span>')
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. search results</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + parseInt(Settings.getInstance().settings.maxSearchResults) + '" />')
					.on('change', function() {
						var val = parseInt(this.value);
						if (!val) {
							this.value = Config.defaultMaxSearchResults;
						} else if (val < 1) {
							this.value = 1;
							val = parseInt(this.value);
						}
						
						var s = Settings.getInstance();
						s.settings.maxSearchResults = val;
						s.saveSettings();
					}),
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Preview attachment images in navigation</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (Settings.getInstance().settings.showAttachedImageAsItemBackground ? 'checked' : '') + ' />')
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
				$('<td colspan="2"/>').append(
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
			
			n.isMobile() ? null : $('<tr/>').append(
				$('<td class="w-auto">Drag start delay time</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + ClientState.getInstance().getViewSettings().dragDelayMillis + '" />')
					.on('change', function() {
						if (parseInt(this.value) < Config.minDragDelayMillis || !parseInt(this.value)) this.value = Config.minDragDelayMillis;
						
						var g = ClientState.getInstance().getViewSettings();
						g.dragDelayMillis = parseInt(this.value);
						ClientState.getInstance().saveViewSettings(g);	
						
						location.reload();					
					})
				)
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
				$('<td colspan="2"/>').append(
					Behaviours.getModeSelector('settingsTreeModeSelectorList', ClientState.getInstance().getViewSettings().navMode)
					.on('change', function(event) {
						n.hideOptions();
						
						var s = ClientState.getInstance().getViewSettings();
						s.navMode = this.value;
						ClientState.getInstance().saveViewSettings(s);

						//NoteTree.getInstance().refresh();
						//n.routing.refresh(); //callSettings();
						location.reload();
					})
				)
			)
		];
		
		var navRows = NoteTree.getInstance().getSettingsPanelContentTableRows();
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

						that.#exportAll('json');									
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
						that.#exportAll('files');
					}),
				])
			),	
		];
		
		return ret;
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Removes the database name from an url.
	 */
	#getDatabaseUrlProposal(url) {
		if (url == 'local') return '';
		
		return url.split('/').slice(0, -1).join('/') + '/';
	}
	
	/**
	 * Export all documents as JSON
	 */
	#exportAll(format) {
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
}