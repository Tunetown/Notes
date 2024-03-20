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
	
	static settingsDocId = 'settings';   /// TODO move to settingsactions
	
	constructor() {
		this.settings = this.getDefaults();
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
			if (!CodeEditor.isValidEditorLanguage(settings.defaultCodeLanguage)) {
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
		n.setCurrentPage(this);
		
		// Set page name in the header
		n.setStatusText("Settings"); 
		
		// Build settings page
		var content = new SettingsContent();
		$('#contentContainer').append(content.getTable());
		content.update();

		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Save Settings" class="fa fa-save" onclick="event.stopPropagation();Settings.getInstance().saveSettings()"></div>'),
		]);
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
}