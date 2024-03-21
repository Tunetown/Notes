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
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
		
		this.settings = this.getDefaults();
	}
	
	/**
	 * Default settings object
	 */
	#getDefaults() {
		return {
			// Theme colors
			mainColor: Config.defaultThemeColor,
			textColor: Config.defaultTextColor,

			// Database options
			autoSaveIntervalSecs: Config.defaultAutosaveIntervalSecs,
			dbAccountName: Config.defaultNotebookName,

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
		var defs = this.#getDefaults();
		
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
		
		this.#checkNumeric(settings, 'autoSaveIntervalSecs', errors);
		this.#checkNumeric(settings, 'maxUploadSizeMB', errors);
		this.#checkNumeric(settings, 'maxSearchResults', errors);
		
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
	#checkNumeric(settings, propName, errors) {
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
	 * Apply current settings to the application
	 */
	apply() {
		this.#app.setMainColor(this.settings.mainColor);
		this.#app.setTextColor(this.settings.textColor);
		this.#app.updateDimensions();
		
		this.#app.nav.updateFavorites();
	}
	
	/**
	 * Save settings
	 */
	save() {
		var that = this;
		
		return this.#app.actions.settings.saveSettings()
		.then(function(data) {
			if (data.message) that.#app.showAlert(data.message, 'S', data.messageThreadId);
		})
		.catch(function(err) {
			that.#app.showAlert('Error saving settings: ' + err.message, 'E', err.messageThreadId);
		})
	}
	
	/**
	 * Set new settings.
	 */
	set(data) {
		if (!data || (Object.keys(data).length === 0)) return;
		
		this.settings = data;
		this.apply();
	}
}