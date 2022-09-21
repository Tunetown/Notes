/**
 * Handles the Spreadsheet editor.
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
class Sheet {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Sheet.instance) Sheet.instance = new Sheet();
		return Sheet.instance;
	}
	
	/**
	 * Tells if the editor needs tree data loaded before load() is called.
	 */
	needsTreeData() {
		return false;
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	load(doc) {
		var that = this;
		var n = Notes.getInstance();
		
		var dataDec = Document.getContent(doc) ? JSON.parse(Document.getContent(doc)) : null;
		this.setCurrent(doc);
		
		n.setCurrentEditor(this);

		var that = this;
		Tools.getScripts([
			'ui/lib/luckysheet/luckysheet.umd.js',
			//'ui/lib/luckysheet/plugin.js',
		])
		/*.then(function(resp) {
			// NOTE: We need to reload bootstrap again after luckysheet is initialized, else 
			//       $.modal() for example wont work anymore. If we do not late load plugin.js 
			//       above, this is not necessary.
			return Tools.getScripts([
				'ui/lib/bootstrap/bootstrap.min.js'
			]);
		})*/
		.then(function(resp) {
			// Create sheet
			var options = {
	            container: 'contentContainer',
	            showinfobar: false,
	            data: dataDec,
	            hook: {
	            	cellUpdateBefore: function(row, col, content, refresh) {
	            		that.setDirty();
	            		that.startDelayedSave();
	            		return true;
	            	}
	            }
	        }
	        luckysheet.create(options);

			// Build buttons
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Save Sheet" id="saveButton" class="fa fa-save" onclick="event.stopPropagation();Sheet.getInstance().saveSheet();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Sheet options..." id="sheetOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();Sheet.getInstance().callOptions(event);"></div>'), 
			]);			

			that.updateStatus();
		})
		.catch(function(err) {
			n.showAlert(err.message, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Remembers the currently loaded note data in this.current. Also adjusts the loaded note text etc.
	 */
	setCurrent(doc) {
		this.current = doc;

		var n = Notes.getInstance();
		
		var txt = "";
		if (doc) txt = doc.name + (n.isMobile() ? "" : " (" + new Date(doc.timestamp).toLocaleString() + ")");

		// Show loaded note in the header bar 
		var that = this;
		n.setStatusText(txt, function(event) {
			event.stopPropagation();
			that.hideOptions();	
			
			// Rename
			DocumentActions.getInstance().renameItem(that.getCurrentId())
			.then(function(data) {
				if (data.message) {
					n.showAlert(data.message, "S", data.messageThreadId);
				}
				n.routing.call(that.getCurrentId());
			})
			.catch(function(err) {
				n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
			});
		});
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.current ? this.current._id : false;
	}

	/**
	 * Calls the note options of the tree
	 */
	callOptions(event) {
		event.stopPropagation();
		
		var n = Notes.getInstance();
		var that = this;
		
		n.showMenu('editorOptions', function(cont) {
			cont.append(
				Document.getEditorOptionMenuItems(that, {
					noDownload: true
				})
			);
		});
	}
	
	getType() {
		return 'sheet';
	}

	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return null;
	}
	
	/**
	 * Hides all option menus for the editor
	 */
	hideOptions() {
		Notes.getInstance().hideMenu();
		Notes.getInstance().hideOptions();
	}
	
	/**
	 * Trigger saving the note (called by buttons)
	 */
	saveSheet() {
		if (this.isDirty()) {
			this.stopDelayedSave();
			
			var n = Notes.getInstance();
			n.showAlert("Saving " + this.current.name + "...", "I", 'SaveMessages');
			
			DocumentActions.getInstance().save(this.getCurrentId(), this.getContent())
			.then(function(data) {
        		if (data.message) n.showAlert(data.message, "S", data.messageThreadId);
        	})
			.catch(function(err) {
        		n.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
        	});
		}
	}
	
	/**
	 * Updates the state change marker etc.
	 */
	updateStatus() {
		// Changed marker in header
		//$('#saveButton').toggleClass("buttonDisabled", !this.isDirty())
		$('#saveButton').css("display", this.isDirty() ? 'inline' : 'none');
		Notes.getInstance().update();
	}
	
	/**
	 * Return current HTML content of the editor.
	 */
	getContent() {
		return JSON.stringify(luckysheet.getAllSheets());
	}
	
	/**
	 * Unloads the editor
	 */
	unload() {
		this.setCurrent();
		this.resetDirtyState();

		luckysheet.destroy();
		
		var n = Notes.getInstance();
		
		if (n.isMobile()) {
			// NOTE: For mobiles, the complete scrolling is dead after leaving the sheet. Therefore we have to
			//       hardcore reload the page here.
			location.reload();
		} else {
			n.update();
		}
	}
	
	/**
	 * Returns the dirty state of the editor
	 */
	isDirty() {
		return this.dirty;
	}

	/**
	 * Set the editor dirty
	 */
	setDirty() {
		this.dirty = true;
		this.updateStatus();
	}
	
	/**
	 * Refresh editor dirty state
	 */
	resetDirtyState() {
		this.dirty = false;
		this.updateStatus();
	}
	
	/**
	 * Triggered at editor changes, this attaches a timer function which will itself trigger saving the note at the time
	 * of execution. Every further call resets the timer duration.
	 */
	startDelayedSave() {
		var secs = Settings.getInstance().settings.autoSaveIntervalSecs;
		if (!secs) return;
		
		var that = this;
		this.stopDelayedSave();
		this.timeoutHandle = setTimeout(function(){
			if (!that.isDirty()) return;
			
			DocumentActions.getInstance().save(that.getCurrentId(), that.getContent()).catch(function(err) {
        		Notes.getInstance().showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
        	});
		}, secs * 1000);
	}
	
	/**
	 * Stop delayed save
	 */
	stopDelayedSave() {
		if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
	}
}
	