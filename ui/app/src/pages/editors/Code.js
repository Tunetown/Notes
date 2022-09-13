/**
 * Handles the Code editor.
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
class Code {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Code.instance) Code.instance = new Code();
		return Code.instance;
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
		
		this.setCurrent(doc);
		
		n.setCurrentEditor(this);

		var that = this;
		Tools.getScripts([
			'ui/lib/codemirror/mode/' + that.getEditorLanguage() + '/' + that.getEditorLanguage() + '.js'
		])
		.then(function(resp) {
			$('#contentContainer').empty();
			
			that.editor = CodeMirror($('#contentContainer')[0], {
				value: Document.getContent(doc),
				mode:  that.getEditorLanguage()
			});
			
			that.editor.on('change', function(obj) {
				that.setDirty();
            	that.startDelayedSave();
			});
			that.editor.on('focus', function(obj) {
				that.hideOptions();
			});
			
			// Build buttons
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Save Note" id="saveButton" class="fa fa-save" onclick="event.stopPropagation();Code.getInstance().saveCode();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Undo" id="undoButton" class="fa fa-undo" onclick="event.stopPropagation();Code.getInstance().undo();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Redo" id="redoButton" class="fa fa-redo" onclick="event.stopPropagation();Code.getInstance().redo();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Note options..." id="codeOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();Code.getInstance().callOptions(event);"></div>'), 
			]);			

			that.updateStatus();
		})
		.catch(function(err) {
			n.showAlert(err.message, 'E', err.messageThreadId);
			
			// Build buttons
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Save Note" id="saveButton" class="fa fa-save" onclick="event.stopPropagation();Code.getInstance().saveCode();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Note options..." id="codeOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();Code.getInstance().callOptions(event);"></div>'), 
			]);			

			that.updateStatus();
		});
	}
	
	undo() {
		this.editor.undo();
	}
	
	redo() {
		this.editor.redo();
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
			Actions.getInstance().renameItem(that.getCurrentId())
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
	 * Creates the language selector.
	 */
	getLanguageSelector(selectedLanguage, cssClass) {
		return $('<select class="' + (cssClass ? cssClass : '') + '"></select>').append([
			$('<option value="markdown">Language: Markdown</option>').prop('selected', 'markdown' == selectedLanguage),
			$('<option value="javascript">Language: Javascript</option>').prop('selected', 'javascript' == selectedLanguage),
			$('<option value="clike">Language: C / C++</option>').prop('selected', 'clike' == selectedLanguage),
			$('<option value="css">Language: CSS</option>').prop('selected', 'css' == selectedLanguage),
			$('<option value="xml">Language: XML</option>').prop('selected', 'xml' == selectedLanguage),
			$('<option value="php">Language: PHP</option>').prop('selected', 'php' == selectedLanguage),
			$('<option value="python">Language: Python</option>').prop('selected', 'python' == selectedLanguage),
			$('<option value="ruby">Language: Ruby</option>').prop('selected', 'ruby' == selectedLanguage),
			$('<option value="shell">Language: Shell</option>').prop('selected', 'shell' == selectedLanguage),
			$('<option value="sql">Language: SQL</option>').prop('selected', 'sql' == selectedLanguage),
		]);
	}
	
	static isValidEditorLanguage(l) {
		var ret = (l == 'markdown') ||
		(l == 'javascript') ||
		(l == 'clike') ||
		(l == 'css') ||
		(l == 'xml') ||
		(l == 'php') ||
		(l == 'python') ||
		(l == 'ruby') ||
		(l == 'shell') ||
		(l == 'sql');
		return ret;
	}
	
	/**
	 * Calls the note options of the tree
	 */
	callOptions(event) {
		event.stopPropagation();
		
		var n = Notes.getInstance();
		var that = this;
		
		n.showMenu('codeOptions', function(cont) {
			cont.append(
				// Language mode
				$('<div class="userbutton"></div>').append(
					that.getLanguageSelector(that.getEditorLanguage(), 'userbuttonselect')
					.on('change', function(event) {
						event.stopPropagation();
						that.hideOptions();
						
						// Change language mode
						Actions.getInstance().saveEditorMode(that.getCurrentId(), that.getEditorMode(), {
							language: this.value
						})
						.then(function(data) {
							n.routing.call(that.getCurrentId());
						})
						.catch(function(err) {
							Notes.getInstance().showAlert('Error: '+ err.message, "E", err.messageThreadId);
						});
					})
					.on('click', function(event) {
						event.stopPropagation();
					})
				),
			)
			.append(
				Document.getEditorOptionMenuItems(that, {
					//downloadMimeType: 'text/plain',
					//downloadFilename: that.current.name + '.txt' 
				})
			);
		});
	}
	
	getType() {
		return 'note';
	}

	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'code';
	}
	
	/**
	 * Returns current language
	 */
	getEditorLanguage() {
		return (this.current && this.current.editorParams && this.current.editorParams.language) ? this.current.editorParams.language : 'markdown';
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
	saveCode() {
		if (this.isDirty()) {
			this.stopDelayedSave();
			
			var n = Notes.getInstance();
			n.showAlert("Saving " + this.current.name + "...", "I", "SaveMessages");
			
			Actions.getInstance().save(this.getCurrentId(), this.getContent())
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
		return this.editor ? this.editor.getValue() : ''; 
	}
	
	/**
	 * Unloads the editor
	 */
	unload() {
		this.setCurrent();
		this.resetDirtyState();

		$('#contentContainer').empty();
		
		var n = Notes.getInstance();
		
		n.update();
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
			var a = Actions.getInstance();
			if (!that.isDirty()) return;
			
			a.save(that.getCurrentId(), that.getContent())
			.catch(function(err) {
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
	
	/**
	 * Check basic property correctness
	 */
	static checkBasicProps(doc, errors) {
		/*if (!doc.editorParams || !doc.editorParams.language) {
			errors.push({
				message: 'Code editor: language missing',
				id: doc._id,
				type: 'E'
			});	
		} else*/ 
		if (doc.editorParams && !Code.isValidEditorLanguage(doc.editorParams.language)) {
			errors.push({
				message: 'Invalid code editor language: ' + doc.editorParams.language,
				id: doc._id,
				type: 'E'
			});		
		}
	}
}
	