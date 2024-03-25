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
	
	#app = null;
	
	#table = null;

	#dbCheckDisplay = null;
	#loginCheckDisplay = null;
	#dbAdminLink = null;
	#loginSettingsButton = null;
	#logoutSettingsButton = null;
	#settingsTrustRow = null;
	#trustCheck = null;
	
	constructor(app) {
		this.#app = app;
		
		this.nextSectionId = 1;
	}
		
	/**
	 * Returns the table element you can add to your app content container.
	 */
	getTable() {
		var d = this.#app.db;
		
		var currentProfile = d.profileHandler.getCurrentProfile();
		const showSyncOptions = currentProfile ? ((currentProfile.clone && currentProfile.autoSync) || currentProfile.url == "local") : true;
		
		this.#table = $('<tbody>');
		
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
		
		this.#table.append(
			$('<br>'),
			$('<br>'),
			$('<br>'),	
		);

		return $('<table class="table settingsForm"/>').append(
			this.#table
		);
	}
	
	/**
	 * Has to be called after the DOM is ready (table has been added)
	 */
	update() {
		var d = this.#app.db;
		var that = this;
		
		// Check DB status
		d.checkRemoteConnection()
		.then(function(data) {
			that.#dbCheckDisplay.html(data.message);
			
			that.#dbAdminLink.empty();
			that.#dbAdminLink.append(
				$('<a href="' + d.getAdminLink() + '" target="_blank">Administrate...</a>')
			);
		})
		.catch(function(err) {
			that.#dbCheckDisplay.html('Error: ' + err.message);
			that.#dbAdminLink.empty();
		});
		
		// Check login status
		d.checkRemoteLogin()
		.then(function(data) {
			that.#loginCheckDisplay.html(data.message);
			
			if (data.ok) {
				that.#loginSettingsButton.hide();
				that.#logoutSettingsButton.show();
			} else {
				that.#loginSettingsButton.show();
				that.#logoutSettingsButton.hide();
			}
		})
		.catch(function(err) {
			that.#loginCheckDisplay.html('Error: ' + err.message);
			that.#loginSettingsButton.show();
			that.#logoutSettingsButton.hide();
		});
		
		// Trust check
		const trusted = this.#app.state.isDeviceTrusted();
		this.#trustCheck.html(trusted ? 'Device is trusted' : '');		
		
		if (trusted) {
			this.#settingsTrustRow.show();
		} else {
			this.#settingsTrustRow.hide();
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
		}
		
		var that = this;
		this.#table.append(
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
		this.#table.find('tr').each(function() {
			if ($(this).data('sectionid') == sectionId) {
				ret = $(this).is(":visible");
			} 
		});
		return ret;
	}
	
	#setSectionVisibility(sectionId, shouldBeVisible) {
		this.#table.find('tr').each(function() {
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
		var d = this.#app.db;
		var that = this;
		
		// Build list of available remotes
		var remoteList = [];
		var profiles = d.profileHandler.getProfiles();
		var currentP = d.profileHandler.getCurrentProfile().url;
		for(var p in profiles) {
			remoteList.push($('<option value="' + profiles[p].url + '" ' + ((profiles[p].url == currentP) ? 'selected' : '') + '>' + Tools.getBasename(profiles[p].url) + '</option>'));
		}

		this.#dbCheckDisplay = $('<div>Database Status</div>');
		this.#loginCheckDisplay = $('<span/>');
		this.#dbAdminLink = $('#dbAdminLink');
		this.#loginSettingsButton = $('<button class="btn btn-secondary settings-button">Login</button>');
		this.#logoutSettingsButton = $('<button class="btn btn-secondary settings-button">Logout</button>');
		this.#settingsTrustRow = $('<div/>');
		this.#trustCheck = $('<span/>');

		var ret = {};
		ret.rowsSelectNotebook = [
			$('<tr/>').append(
				$('<td class="w-auto">Selected Notebook</td>'),
				$('<td colspan="2"/>').append(
					$('<select class="settings-button cdbEndpointSelect"></select>')
					.append(remoteList)
					.on('change', function(event) {
						var url = this.value;
						
						d.reset();
	
						console.log('Switching to notebook at ' + url);
	
						that.#app.routing.call('settings', url);
					}),
					$('<br>'),
					$('<br>'),
					this.#dbCheckDisplay,
					this.#dbAdminLink,
					$('<br>'),
					
					$('<span><b>URL:</b> ' + d.profileHandler.getCurrentProfile().url + '</span>'),
					$('<a style="cursor: pointer; padding-left: 10px;">Copy</a>')
					.on('click', function(event) {
						navigator.clipboard.writeText(d.profileHandler.getCurrentProfile().url);
						that.#app.view.message('Copied URL to Clipboard', 'I');
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
					this.#loginSettingsButton
					.on('click', function() {
						d.login()
						.then(function(data) {
							that.#app.routing.call('settings');
						})
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					
					this.#logoutSettingsButton
					.on('click', function(event) {
						event.stopPropagation();
						
						d.logout()
						.then(function(data) {
							if (!data.ok) {
								that.#app.view.message(data.message, 'E', data.messageThreadId);
								return;
							}
							d.reset();
							that.#app.routing.call('settings');
						})
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					
					this.#loginCheckDisplay,
					
					this.#settingsTrustRow.append(
						$('<button class="btn btn-secondary settings-button">Untrust</button>')
						.on('click', function(event) {
							event.stopPropagation();
							
							that.#app.state.setTrustedDeviceCredentials();
							
							that.#app.view.message("Deleted device credentials.", 'I');
							
							that.#app.routing.call('settings');
						}), 
						
						this.#trustCheck,							
					)
				])
			),	
			
			$('<tr/>').append(
				$('<td>Options</td>'),
				$('<td colspan="2"/>').append(!d.profileHandler.getCurrentProfile().url ? null : [

					$('<button class="btn btn-secondary settings-button">Open Notebook from CouchDB URL...</button>')
					.on('click', function() {
						var url = prompt('CouchDB Address:', SettingsContent.getDatabaseUrlProposal(d.profileHandler.getCurrentProfile().url));
						if (!url) return;
						
						d.reset();
						that.#app.routing.call('', url);
					}),
					
					(d.profileHandler.getCurrentProfile().url == "local") ? null : $('<button class="btn btn-secondary settings-button">Close Notebook...</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						if (!confirm('Really close the notebook at ' + d.profileHandler.getCurrentProfile().url + '? This will only delete local data, the remote database is not being touched.')) {
							return;
						}
						d.profileHandler.deleteProfile();
						d.reset();
						
						that.#app.routing.call('settings');
					}),
					
					!d.profileHandler.getCurrentProfile().clone ? null : $('<br>'),
					
					!d.profileHandler.getCurrentProfile().clone ? null : $('<button class="btn btn-secondary settings-button">Replicate Notebook to URL</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var url = prompt('URL to replicate to: ');
						if (!url) return;
						
						that.#app.routing.callConsole();
						
						d.replicateLocalTo(url)
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					
					/*
					!d.profileHandler.getCurrentProfile().clone ? null : $('<button class="btn btn-secondary settings-button">Replicate Notebook to URL</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var url = prompt('URL to replicate to: ');
						if (!url) return;
						
						that.#app.routing.callConsole();
						d.replicateLocalTo(url)
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					*/
					//$('<br>'),
					//$('<textarea readonly class="dbLink">' + that.#app.routing.getBasePath() + '</textarea>'),
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
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  !d.profileHandler.profileCanClone(),
								onChange: function() {
									var p = d.profileHandler.getCurrentProfile();
									p.clone = !!this.getChecked();
									d.profileHandler.saveProfile(p);
									
									d.reset();
									that.#app.routing.call('settings');
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
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  !d.profileHandler.profileCanAutoSync(),
								onChange: function() {
									var p = d.profileHandler.getCurrentProfile();
									p.autoSync = !!this.getChecked();
									d.profileHandler.saveProfile(p);
									
									d.reset();
									that.#app.routing.call('settings');
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
					$('<input type="text" value="' + this.#app.settings.settings.dbAccountName + '" />')
					.on('change', function() {
						var s = that.#app.settings;
						s.settings.dbAccountName = this.value;
						s.save();
						
						location.reload();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Background Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + this.#app.settings.settings.mainColor + '"/>')
					.on('change', function() {
						var s = that.#app.settings;
						s.settings.mainColor = this.value;
						s.apply();
					})
					.on('input', function() {
						var s = that.#app.settings;
						s.settings.mainColor = this.value;
						s.apply();
					})
					.on('blur', function() {
						var s = that.#app.settings;
						s.save();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Theme Text Color</td>'),
				$('<td colspan="2" />').append(
					$('<input type="color" value="' + this.#app.settings.settings.textColor + '"/>')
					.on('change', function() {
						var s = that.#app.settings;
						s.settings.textColor = this.value;
						s.apply();
					})
					.on('input', function() {
						var s = that.#app.settings;
						s.settings.textColor = this.value;
						s.apply();
					})
					.on('blur', function() {
						var s = that.#app.settings;
						s.save();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Editor Defaults</td>'),
				$('<td colspan="2"/>').append(
					Document.getEditorModeSelector(this.#app.settings.settings.defaultNoteEditor ? this.#app.settings.settings.defaultNoteEditor : 'richtext', {
						hideKanban: true,
						cssClass: 'settingsSelect'
					})
					.on('change', function(event) {
						var s = that.#app.settings;
						
						s.settings.defaultNoteEditor = this.value;
						s.save();
						
						that.#app.routing.call('settings');
					}),
					
					!(this.#app.settings.settings.defaultNoteEditor && this.#app.settings.settings.defaultNoteEditor == 'code') ? null : 
					CodeEditor.getLanguageSelector(this.#app.settings.settings.defaultCodeLanguage ? this.#app.settings.settings.defaultCodeLanguage : 'markdown')
					.on('change', function(event) {
						var s = that.#app.settings;
						
						s.settings.defaultCodeLanguage = this.value;
						s.save();
					})
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Auto Save Interval</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.settings.settings.autoSaveIntervalSecs + '" />')
					.on('change', function() {
						var s = that.#app.settings;
						
						this.value = parseFloat(this.value) ? parseFloat(this.value) : 0;
						if (this.value < 0) {
							this.value = 0;
						}									
						
						s.settings.autoSaveIntervalSecs = parseFloat(this.value);
						s.save();
					}),
					$('<span class="settings-explanation">Seconds (Zero to disable)</span>')
				),
			),
			$('<tr/>').append(
				$('<td class="w-auto">Ask before Moving</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.settings.settings.askBeforeMoving ? "checked" : "") + '/>')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = that.#app.settings;
									s.settings.askBeforeMoving = this.getChecked();
									s.save();
								}
							});
						}, 0);
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Reduce History at Save</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.settings.settings.reduceHistory ? "checked" : "") + '/>')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = that.#app.settings;
									s.settings.reduceHistory = this.getChecked();
									s.save();
								}
							});
						}, 0);
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. upload file size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + parseFloat(this.#app.settings.settings.maxUploadSizeMB) + '" />')
					.on('change', function() {
						var val = parseFloat(this.value);
						if (!val || val < 0) {
							this.value = 0;
							val = parseFloat(this.value);
						}
						
						var s = that.#app.settings;
						s.settings.maxUploadSizeMB = val;
						s.save();
					}),
					$('<span class="settings-explanation">MB (Zero to disable)</span>')
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. search results</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + parseInt(this.#app.settings.settings.maxSearchResults) + '" />')
					.on('change', function() {
						var val = parseInt(this.value);
						if (!val) {
							this.value = Config.defaultMaxSearchResults;
						} else if (val < 1) {
							this.value = 1;
							val = parseInt(this.value);
						}
						
						var s = that.#app.settings;
						s.settings.maxSearchResults = val;
						s.save();
					}),
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Preview attachment images in navigation</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.settings.settings.showAttachedImageAsItemBackground ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = that.#app.settings;
									s.settings.showAttachedImageAsItemBackground = !!this.getChecked();
									
									s.save();
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
					$('<input type="text" value="' + this.#app.getHeaderSize()  + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minHeaderSize || !parseFloat(this.value)) this.value = Config.minHeaderSize;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.headerSizeMobile = parseFloat(this.value);										
						} else {
							g.headerSizeDesktop = parseFloat(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Option Button Size</td>'),
				$('<td colspan="2" />').append(
					$('<input type="text" value="' + this.#app.getRoundedButtonSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minButtonSize || !parseFloat(this.value)) this.value = Config.minButtonSize;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.optionTextSizeMobile = parseFloat(this.value);										
						} else {
							g.optionTextSizeDesktop = parseFloat(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
						
						that.#app.actions.nav.requestTree()
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Footer Size</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.getFooterSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minFooterSize || !parseFloat(this.value)) this.value = Config.minFooterSize;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.footerSizeMobile = parseFloat(this.value);										
						} else {
							g.footerSizeDesktop = parseFloat(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Landing Page: Redirect to last opened</td>'),
				$('<td colspan="2"/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.isLastOpenedUrlRedirectEnabled() ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.#app.state.enableLastOpenedUrlRedirect(!!this.getChecked());
								}
							});
						}, 0);
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Show Favorites</td>'),
				$('<td colspan="2"/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (!this.#app.state.getViewSettings().dontShowFavorites ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = that.#app.state.getViewSettings();
									cs.dontShowFavorites = !this.getChecked();
									that.#app.state.saveViewSettings(cs);
									
									that.#app.nav.resetFavoriteBuffers();
									that.#app.nav.refresh();
								}
							});
						}, 0);
					}),
					
					$('<span style="margin-left: 5px" ></span>').html('Uses ' + JSON.stringify(this.#app.state.getFavorites()).length + " bytes of local memory, "),
					
					$('<a style="margin-left: 5px" href="javascript:void(0);">Clear...</a>')
					.on('click', function(event) {
						event.stopPropagation();
						
						that.#app.nav.resetFavoriteBuffers();
						that.#app.clearFavorites();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Favorites Size</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + (this.#app.state.getViewSettings().favoritesSize) + '" />')
					.on('change', function() {
						if (!parseInt(this.value)) this.value = Config.defaultFavoritesSize;
						if (parseInt(this.value) < Config.minFavoritesSize) this.value = Config.minFavoritesSize;
						
						var cs = that.#app.state.getViewSettings();
						cs.favoritesSize = parseInt(this.value);
						that.#app.state.saveViewSettings(cs);
						
						that.#app.nav.resetFavoriteBuffers();
						that.#app.nav.refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Max. Number of Favorites</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + (this.#app.state.getViewSettings().favoritesNum) + '" />')
					.on('change', function() {
						if (!parseInt(this.value)) this.value = Config.defaultFavoritesAmount;
						if (parseInt(this.value) < 1) this.value = 1;
						
						var cs = that.#app.state.getViewSettings();
						cs.favoritesNum = parseInt(this.value);
						that.#app.state.saveViewSettings(cs);
						
						that.#app.nav.resetFavoriteBuffers();
						that.#app.nav.refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Show current Document in Favorites</td>'),
				$('<td colspan="2"/>').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.getViewSettings().dontShowCurrentInFavorites ? '' : 'checked') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = that.#app.state.getViewSettings();
									cs.dontShowCurrentInFavorites = !this.getChecked();
									that.#app.state.saveViewSettings(cs);
									
									that.#app.nav.resetFavoriteBuffers();
									that.#app.nav.refresh();
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
			this.#app.device.isLayoutMobile() ? null : $('<tr/>').append(
				$('<td class="w-auto">Navigation Width</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.nav.getContainerWidth() + '" />')
					.on('change', function() {
						if (!parseInt(this.value)) this.value = "";
						if (parseInt(this.value) < 0) this.value = "";
						
						if (that.#app.device.isLayoutMobile()) return;
						
						var state = that.#app.state.getTreeState();
						state.treeWidth = parseInt(this.value);
						that.#app.state.setTreeState(state);
			
						that.#app.nav.refresh();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Text Size</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.nav.getTreeTextSize() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minNavigationTextSize || !parseFloat(this.value)) this.value = Config.minNavigationTextSize;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.navTextSizeMobile = parseFloat(this.value);										
						} else {
							g.navTextSizeDesktop = parseFloat(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
						
						that.#app.actions.nav.requestTree()
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					})
				),
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Item Size</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.settings.getNavigationItemHeight() + '" />')
					.on('change', function() {
						if (parseFloat(this.value) < Config.minDetailNavigationItemHeight || !parseFloat(this.value)) this.value = Config.minDetailNavigationItemHeight;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.detailItemHeightMobile = parseFloat(this.value);										
						} else {
							g.detailItemHeightDesktop = parseFloat(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
						
						that.#app.actions.nav.requestTree()
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					})
				),
			),
			
			this.#app.device.isTouchAware() ? null : $('<tr/>').append(
				$('<td class="w-auto">Drag start delay time</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + this.#app.state.getViewSettings().dragDelayMillis + '" />')
					.on('change', function() {
						if (parseInt(this.value) < Config.minDragDelayMillis || !parseInt(this.value)) this.value = Config.minDragDelayMillis;
						
						var g = that.#app.state.getViewSettings();
						g.dragDelayMillis = parseInt(this.value);
						that.#app.state.saveViewSettings(g);	
						
						location.reload();					
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Animation Time</td>'),
				$('<td colspan="2"/>').append(
					$('<input type="text" value="' + MuuriGrid.getAnimationDuration(this.#app) + '" />')
					.on('change', function() {
						if (parseInt(this.value) < Config.minDetailNavigationAnimationDuration || !parseInt(this.value)) this.value = Config.minDetailNavigationAnimationDuration;
						
						var g = that.#app.state.getLocalSettings();
						if (that.#app.device.isLayoutMobile()) {
							g.navigationAnimationDurationMobile = parseInt(this.value);										
						} else {
							g.navigationAnimationDurationDesktop = parseInt(this.value);
						}
						that.#app.state.setLocalSettings(g);
						
						that.#app.update();
						
						that.#app.actions.nav.requestTree()
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Navigation Mode</td>'),
				$('<td colspan="2"/>').append(
					Behaviours.getModeSelector('settingsTreeModeSelectorList', this.#app.state.getViewSettings().navMode)
					.on('change', function(event) {
						that.#app.hideOptions();
						
						var s = that.#app.state.getViewSettings();
						s.navMode = this.value;
						that.#app.state.saveViewSettings(s);

						location.reload();
					})
				)
			)
		];
		
		var navRows = this.#app.nav.getSettingsPanelContentTableRows();
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
						new Import(new NotesImporter(that.#app, {
							importInternal: true,
							createIds: true,
							useRootItem: false,
						})).startFileImport();
					}),
					
					$('<button class="btn btn-secondary settings-button">Verify Raw Data (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.routing.callVerifyBackup();
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
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.getConsoleSettings().persist ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								onChange: function() {
									var s = that.#app.state.getConsoleSettings();
									s.persist = !!this.getChecked();
									that.#app.state.saveConsoleSettings(s);
									
									Console.clear();
									that.#app.view.message('Cleared console logs.', 'I');
								}
							});
						}, 0);
					}),

					$('<a style="cursor: pointer; padding-left: 10px;">Open Console</a>')
					.on('click', function(event) {
						that.#app.routing.callConsole();
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Override Layout Mode</td>'),
				$('<td colspan="2" />').append(
					$('<select></select>').append([
						$('<option value="off">Off</option>'),
						$('<option value="landscape">Landscape</option>'),
						$('<option value="portrait">Portrait</option>'),
						$('<option value="mobile">Mobile</option>'),
					])
					.each(function(i) {
						var mode = that.#app.state.getMobileOverride();
						if (!mode) mode = "off";
						$(this).val(mode);
						
						$(this).on('change', function(event) {
							that.#app.state.setMobileOverride($(this).val())
							location.reload();
						});
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Override Input Mode</td>'),
				$('<td colspan="2" />').append(
					$('<select></select>').append([
						$('<option value="off">Off</option>'),
						$('<option value="touch">Touch Input</option>'),
						$('<option value="notouch">Mouse Input</option>'),
					])
					.each(function(i) {
						var mode = that.#app.state.getTouchAwareOverride();
						if (!mode) mode = "off";
						$(this).val(mode);
						
						$(this).on('change', function(event) {
							that.#app.state.setTouchAwareOverride($(this).val())
							location.reload();
						});
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Rich Text Editor: Auto-Format links</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.getEditorSettings().dontReplaceLinksInRTEditor ? '' : 'checked') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = that.#app.state.getEditorSettings();
									cs.dontReplaceLinksInRTEditor = !this.getChecked();
									that.#app.state.saveEditorSettings(cs);
								}
							});
						}, 0);
					})
				)
			),
			
			$('<tr/>').append(
				$('<td class="w-auto">Rich Text Editor: Auto-Format hashtags</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.getEditorSettings().dontReplaceTagsInRTEditor ? '' : 'checked') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									var cs = that.#app.state.getEditorSettings();
									cs.dontReplaceTagsInRTEditor = !this.getChecked();
									that.#app.state.saveEditorSettings(cs);
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
						
						that.#app.routing.call('check');
					}),
					
					// Clear local data
					$('<button class="btn btn-secondary settings-button">Clear Local Data</button>')
					.on('click', function(event) {
						event.stopPropagation();
						
						if (!confirm("Really delete the local database?")) {
							return;
						}
						
						var prom = d.clearLocalDatabase();
						if (!prom) {
							that.#app.view.message('Could not delete database.', 'E');
							return;
						}
						
						prom
						.then(function(data) {
							that.#app.view.message('Local database is now empty.', 'S');
							d.reset();
							that.#app.routing.call('settings');
						})
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					
					// Generate documents
					$('<button class="btn btn-secondary settings-button">Generate Random Documents</button>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.routing.call('generate');
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
						that.#app.routing.callRawView(SettingsActions.settingsDocId);
					}),
					
					// Edit global-meta document
					$('<button class="btn btn-secondary settings-button">Edit Global Metadata Document</button>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.routing.callRawView(MetaActions.metaDocId);
					}),

				])
			)
		];
		
		//////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////
		//////////////////////////////////////////////////////////////////////////
		
		ret.rowsExperimentalFeatures = [
			$('<tr/>').append(
				$('<td class="w-auto">Enable Graph Page</td>'),
				$('<td colspan="2" />').append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.experimentalFunctionEnabled(GraphPage.experimentalFunctionId) ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.#app.state.enableExperimentalFunction(GraphPage.experimentalFunctionId, !!this.getChecked());
									that.#app.update();
								}
							});
						}, 0);
					})
				)
			),
			
			/*$('<tr/>').append(
				$('<td class="w-auto">Import from Trello</td>'),
				$('<td colspan="2"/>').append([
					$('<button class="btn btn-secondary settings-button">Import Board from Trello (JSON)</button>')
					.on('click', function(event) {
						event.stopPropagation();
						new Import(new TrelloImporter(that.#app)).startFileImport();
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
	static getDatabaseUrlProposal(url) {    // #IGNORE static
		if (url == 'local') return '';
		
		return url.split('/').slice(0, -1).join('/') + '/';
	}
	
	/**
	 * Export all documents as JSON
	 */
	#exportAll(format) {
		var that = this;
		
		if (!format) {
			this.#app.view.message("No format specified", "E");
			return;
		}
		
		// Raw json export
		if (format == 'json') {
			if (!confirm('Export all documents including settings and metadata?')) return;

			(new NotesExporter(this.#app)).exportDatabase()
			.then(function(data) {
				that.#app.view.message('Exported ' + ((data && data.docs) ? data.docs.length : "[unknown]") + ' documents.', 'S');
			})
			.catch(function(err) {
				that.#app.errorHandler.handle(err);
			});
		}
		
		// Obsidian export
		if (format == 'files') {
			var children = this.#app.data.getChildren("", true);
			
			if (!confirm('Export all ' + children.length + ' documents?')) return;
			
			var ids = [];
			for(var d in children) {
				ids.push(children[d]._id);
			}

			new ObsidianExporter(this.#app).export(ids)
			.then(function(/*data*/) {
				that.#app.view.message('Exported ' + children.length + ' documents.', 'S');
			})
			.catch(function(err) {
				that.#app.errorHandler.handle(err);
			});
		}
	}
}