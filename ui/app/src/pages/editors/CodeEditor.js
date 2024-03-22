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
class CodeEditor extends RestorableEditor {
	
	#current = null;              // Current document
	
	#editor = null;               // Editor instance
	#versionRestoreData = null;
	#versionRestoreMode = false;
	
	#timeoutHandle = null;
	#highlightState = null;
	
	#saveButton = null;
	#discardButton = null;
	
	/**
	 * Sets data to be loaded into the editor instead of the passed data in load().
	 */
	setVersionRestoreData(data) {
		this.#versionRestoreData = data;
	}
	
	/**
	 * Returns if the editor is in restore mode.
	 */
	getRestoreMode() {
		return !!this.#versionRestoreMode;
	}
	
	/**
	 * Stop delayed save
	 */
	async stopDelayedSave() {
		if (this.#timeoutHandle) clearTimeout(this.#timeoutHandle);
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current._id : false;
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current;
	}

	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'code';
	}
	
	/**
	 * Return current HTML content of the editor.
	 */
	getContent() {
		return this.#editor ? this.#editor.getValue() : ''; 
	}
	
	/**
	 * Hides all option menus for the editor
	 *
	hideOptions() {
		this._app.hideMenu();
		this._app.hideOptions();
	}
	
	/**
	 * Unloads the editor
	 */
	async unload() {
		this.#current = null;
		this.setVersionRestoreData(false);
		
		this._app.update();  // TODO still necessary
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	async load(doc) {
		var that = this;
		
		Document.brokenLinksWarning(doc);
		
		this.#current = doc;

		// Show loaded note in the header bar 
		var txt = "";
		if (doc) txt = doc.name + (this._app.device.isLayoutMobile() ? "" : " (" + new Date(doc.timestamp).toLocaleString() + ")");
		this._tab.setStatusText(txt);
		
		await Tools.getScripts([
			'ui/lib/codemirror/mode/' + this.#getEditorLanguage() + '/' + this.#getEditorLanguage() + '.js'
		]);
		
		var ec = {};
		ec["'" + Linkage.startChar + "'"] = function(cm, pred) { return that.#triggerAutocomplete(cm, pred); };
		ec["'" + Hashtag.startChar + "'"] = function(cm, pred) { return that.#triggerAutocomplete(cm, pred); };
		
		var content = Document.getContent(doc);
		if (this.#versionRestoreData) content = this.#versionRestoreData;
		
		// Create the editor instance
		this.#editor = CodeMirror(this._tab.getContainer()[0], {
			value: content,
			mode: this.#getEditorLanguage(),
			extraKeys: ec,
			hintOptions: {
				completeSingle: false,
				hint: function(cm, option) {
					return that.#handleAutoComplete(cm, option);
				}, 
			},
		});
		
		var highlightOverlay = {
			token: function(stream /*, state*/) {
				if (stream.eol()) return null;
					
				if (!that.#highlightState || stream.sol()) that.#highlightState = {};
				var state = that.#highlightState; 
								
				var pos = stream.pos;
				var ch = stream.next();
	
				that._app.hashtag.parseChar(ch, pos, state, stream.eol());
				while (!stream.eol() && Hashtag.isCapturing(state)) {
					pos = stream.pos;
					ch = stream.next();
				
					var token = that._app.hashtag.parseChar(ch, pos, state, stream.eol());
					if (token) {
						if (!stream.sol() && !stream.eol()) stream.backUp(1);
					
						return CodeEditor.#tagClassPostfix;
					}
				}
	
				return null;
			}
		}

		this.#editor.removeOverlay(highlightOverlay);
		this.#editor.addOverlay(highlightOverlay);
		
		this.#editor.on('change', function(/*obj*/) {
			that.setDirty();
			that.#updateLinkClickHandlers();
        	that.#startDelayedSave();
		});
		this.#editor.on('focus', function(/*obj*/) {
			that._app.hideOptions();
		});
		
		// Build buttons
		this.#saveButton = $('<div type="button" data-toggle="tooltip" title="Save Note" class="fa fa-save"></div>');
		this.#discardButton = $('<div type="button" data-toggle="tooltip" title="Discard and Reload Note" class="fa fa-times"></div>');
		
		if (this.#versionRestoreData) {
			this.#versionRestoreMode = true;
			
			this._app.setButtons([ 
				this.#saveButton
				.on('click', function(event) {
					event.stopPropagation();
					that.#saveCode();
				}), 
				
				this.#discardButton
				.on('click', function(event) {
					event.stopPropagation();
					that.#discard(true);
				}), 
			]);
		} else {
			this.#versionRestoreMode = false;
			
			this._app.setButtons([ 
				this.#saveButton
				.on('click', function(event) {
					event.stopPropagation();
					that.#saveCode();
				}), 
				
				$('<div type="button" data-toggle="tooltip" title="Undo" class="fa fa-undo"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#undo();
				}), 
				
				$('<div type="button" data-toggle="tooltip" title="Redo" class="fa fa-redo"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#redo();
				}), 
				
				$('<div type="button" data-toggle="tooltip" title="Note options..." class="fa fa-ellipsis-v"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#callPageOptions(event);
				}), 
			]);
		}

		this.#updateStatus();
		this.#updateLinkClickHandlers();
		
		if (this.#versionRestoreData) {
			this.setDirty();
		}
		
		this.#versionRestoreData = false;
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Set the editor dirty
	 */
	setDirty() {
		super.setDirty();
		
		this.#updateStatus();
	}
	
	/**
	 * Refresh editor dirty state
	 */
	resetDirtyState() {
		super.resetDirtyState();
		
		this.#updateStatus();
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Check basic property correctness TODO solve otherwise
	 */
	static checkBasicProps(doc, errors) { 
		if (doc.editor != 'code') return;
		
		if (doc.editorParams && !CodeEditor.isValidEditorLanguage(doc.editorParams.language)) {
			errors.push({
				message: 'Invalid code editor language: ' + doc.editorParams.language,
				id: doc._id,
				type: 'E'
			});		
		}
	}
	
	/**
	 * Creates the language selector.
	 */
	static getLanguageSelector(selectedLanguage, cssClass) {     // #IGNORE static 
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
	
	/**
	 * Returns if the passed language is valid for the editor.
	 */
	static isValidEditorLanguage(l) {     // #IGNORE static 
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
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Undo (CodeMirror)
	 */
	#undo() {
		this.#editor.undo();
	}
	
	/**
	 * Redo (CodeMirror)
	 */
	#redo() {
		this.#editor.redo();
	}

	/**
	 * Calls the note options of the tree
	 */
	#callPageOptions(event) {
		event.stopPropagation();
		
		var that = this;
		
		this._app.showMenu('codeOptions', function(cont) {
			cont.append(
				// Language mode
				$('<div class="userbutton"></div>').append(
					CodeEditor.getLanguageSelector(that.#getEditorLanguage(), 'userbuttonselect')
					.on('change', function(event) {
						event.stopPropagation();
						that._app.hideOptions();
						
						// Change language mode
						that._app.actions.editor.saveEditorMode(that.getCurrentId(), that.getEditorMode(), {
							language: this.value
						})
						.then(function(data) {
							that._app.routing.call(that.getCurrentId());
						})
						.catch(function(err) {
							that._app.showAlert('Error: '+ err.message, "E", err.messageThreadId);
						});
					})
					.on('click', function(event) {
						event.stopPropagation();
					})
				),
			)
			.append(
				new PageMenu(that._app).get(that, {
					//downloadMimeType: 'text/plain',
					//downloadFilename: that.#current.name + '.txt' 
				})
			);
		});
	}
	
	/**
	 * Returns current language
	 */
	#getEditorLanguage() {
		return (this.#current && this.#current.editorParams && this.#current.editorParams.language) ? this.#current.editorParams.language  : 'markdown';  // TODO move to Config 
	}
	
	/**
	 * Trigger saving the note (called by buttons)
	 */
	#saveCode() {
		if (this.isDirty()) {
			this.stopDelayedSave();
			
			this._app.showAlert("Saving " + this.#current.name + "...", "I", "SaveMessages");
			
			var that = this;
			this._app.actions.document.save(this.getCurrentId(), this.getContent())
			.then(function(data) {
        		if (data.message) that._app.showAlert(data.message, "S", data.messageThreadId);

				if (that.#versionRestoreMode) {
					that._app.routing.refresh();
				}
        	})
        	.catch(function(err) {
        		that._app.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
        	});
		}
	}
	
	/**
	 * Updates the state change marker etc.
	 */
	#updateStatus() {
		// Changed marker in header
		this.#saveButton.css("display", this.isDirty() ? 'inline' : 'none');
		this._app.update();
	}
	
	/**
	 * Reloads the content from the server, discarding the contents.
	 */
	#discard(removeButton) {
		this.setVersionRestoreData(false);
		
		if (removeButton) this.#discardButton.css("display", "none");
		
		this._app.showAlert("Action cancelled.", "I");

		this._app.routing.call("history/" + this.getCurrentId());
	}
	
	/**
	 * Triggered at editor changes, this attaches a timer function which will itself trigger saving the note at the time
	 * of execution. Every further call resets the timer duration.
	 */
	#startDelayedSave() {
		var secs = this._app.settings.settings.autoSaveIntervalSecs;
		if (!secs) return;
		
		var that = this;
		this.stopDelayedSave();
		this.#timeoutHandle = setTimeout(function(){
			if (!that.isDirty()) return;
			
			that._app.actions.document.save(that.getCurrentId(), that.getContent())
			.catch(function(err) {
        		that._app.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
        	});
		}, secs * 1000);
	}
	
	/**
	 * Called every time the users types '['. If the character before the cursor 
	 * aslo is the same character, auto complete is being triggered. 
	 */
	#triggerAutocomplete(cm, pred) {
		var cursor = cm.getCursor();
		var line = cm.getLine(cursor.line);
		var lastChar = line.substring(cursor.ch-1, cursor.ch);

		// Trigger autocomplete if the user is entering [ the second time
		if (lastChar == Linkage.startChar) {
			if (!pred || pred()) setTimeout(function() {
				if (!cm.state.completionActive) {
					cm.showHint();
				}
			}, 0);
		}
		
		// Trigger autocomplete if the user is entering #
		if (!pred || pred()) setTimeout(function() {
			if (!cm.state.completionActive) {
				cm.showHint();
			}
		}, 0);

        return CodeMirror.Pass;
	}
	
	/**
	 * This is wrapped to the autocompleter of CodeMirror and delivers 
	 * the proposals when auto complete has been triggered.
	 */
	#handleAutoComplete(cm, option) {
		var that = this;
		
		return new Promise(function(accept) {
			setTimeout(function() {
				// Get the current line and calculate the start and end positions 
				// of the word to complete
				var cursor = cm.getCursor();
				var line = cm.getLine(cursor.line);
	        
				var start = cursor.ch;
				var end = cursor.ch;
				while (start && /\w/.test(line.charAt(start - 1))) --start;
				while (end < line.length && /\w/.test(line.charAt(end))) ++end;
				
				var typedToken = line.substring(start, end);
				var startToken = line.substring(start-1, start);

				var data = {};
				if (startToken == Linkage.startChar) {
					data = that.#getLinkAutocompleteOptions(cm, option, typedToken, start, end);
				}

				if (startToken == Hashtag.startChar) {
					data = that.#getTagAutocompleteOptions(cm, option, typedToken, start, end);
				}

				if (!data.list) data.list = [];

				return accept({
					list: data.list,
					selectedHint: data.selectedHint,
					from: CodeMirror.Pos(cursor.line, start),
					to: CodeMirror.Pos(cursor.line, end),
				});   
			}, 0);
		});
	}

	static #linkTextPrefix = ' -> ';     // #IGNORE static 

	/**
	 * This actually composes the autocomplete list.
	 */
	#getLinkAutocompleteOptions(cm, option, typedToken, start, end) {
		var proposals = this._app.data.getLinkAutocompleteList(typedToken);
		var list = [];
		for(var i in proposals) {
			list.push({
				text: proposals[i].id + Linkage.separator + CodeEditor.#linkTextPrefix + proposals[i].displayText + Linkage.endTag,
				displayText: proposals[i].text
			});
		}
		
		return {
			list: list,
			selectedHint: 0
		};
	}
	
	/**
	 * This actually composes the autocomplete list.
	 */
	#getTagAutocompleteOptions(cm, option, typedToken, start, end) {
		var proposals = this._app.data.getTagAutocompleteList(typedToken);
		var list = [];
		for(var i in proposals) {
			list.push({
				text: proposals[i].id + ' ',
				displayText: Hashtag.startChar + proposals[i].text,
				className: this._app.hashtag.getListStyleClass(proposals[i].id)
			});
		}
		
		return {
			list: list,
			selectedHint: 0
		};
	}
	
	static #linkClass = 'cm-link';                              // #IGNORE static 
	static #tagClassPostfix = 'notestag';                       // #IGNORE static 
	static #tagClass = 'cm-' + CodeEditor.#tagClassPostfix;     // #IGNORE static 
	
	/**
	 * Re-sets all onclick handlers for the internal links.
	 */
	#updateLinkClickHandlers() {
		var that = this;
		
		function linkClick(event) {
			event.preventDefault();
			event.stopPropagation();

			that.#onLinkClick(event);
		}
		
		function tagClick(event) {
			event.preventDefault();
			event.stopPropagation();

			that.#onTagClick(event);
		}
		
		setTimeout(function() {
			const links = document.getElementsByClassName(CodeEditor.#linkClass);
			for (var i=0; i<links.length; ++i) {
				links[i].removeEventListener("click", linkClick);
				links[i].addEventListener("click", linkClick);
				
				links[i].removeEventListener("touchstart", linkClick);
				links[i].addEventListener("touchstart", linkClick);
			}
		}, 0);
		
		setTimeout(function() {
			const tags = document.getElementsByClassName(CodeEditor.#tagClass);
			for (var i=0; i<tags.length; ++i) {
				tags[i].removeEventListener("click", tagClick);
				tags[i].addEventListener("click", tagClick);
				
				tags[i].removeEventListener("touchstart", tagClick);
				tags[i].addEventListener("touchstart", tagClick);
				
				// Colors
				const tag = that._app.hashtag.extractTagFromElement($(tags[i]));
				const tagColor = that._app.hashtag.getColor(tag);
				if (tag) $(tags[i]).css('background-color', tagColor);
				if (tag) $(tags[i]).css('color', Tools.getForegroundColor(tagColor));
			}
		}, 0);
	}
	
	/**
	 * Click handler for internal links.
	 */
	#onLinkClick(event) {
		if (!event.currentTarget) return;
		
		const link = $(event.currentTarget).html();
		if (!link) return;
		
		const meta = Linkage.splitLink(link);
		
		this._callDocument(meta.target);
	}
	
	/**
	 * Click handler for hashtags.
	 */
	#onTagClick(event) {
		if (!event.currentTarget) return;
		
		const tag = $(event.currentTarget).text().substring(Hashtag.startChar.length);
		if (!tag) return;
		
		if (event.ctrlKey || event.metaKey) {
			const currentId = this.getCurrentId();
			this._app.routing.callHashtags(currentId);
		} else {
			this._app.hashtag.showTag(tag);
		}
	}
}
	