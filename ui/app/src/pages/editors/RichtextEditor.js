/**
 * Handles the TinyMCE editor.
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
class RichtextEditor extends RestorableEditor {
	
	static #linkClass = 'notesTMCELink';       ///< Class for the internal links  // #IGNORE static 
	static #tagClass = 'notesTMCETag';         ///< Class for the hashtags        // #IGNORE static 
	
	#current = null;                            // Current document
	#editorId = false;                          // Editor element ID (must be unique globally)
	
	#versionRestoreData = null;
	#versionRestoreMode = false;
	
	#timeoutHandle = null;
	
	#cursorElementId = false;
	#cursorElementSeed = false;
	
	#saveButton = null;
	#discardButton = null;
	
	constructor() {
		super();
		
		// Set editor element ID (must be unique globally, so we generate a 
		// new one for each instance of this editor)
		this.#editorId = "editorContent_" + this._getPageId();   
	}
	
	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'richtext';
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
	 * Return current HTML content of the editor.
	 */
	getContent() {
		return this.#getEditor().getContent();
	}
	
	/**
	 * Stop delayed save
	 */
	async stopDelayedSave() {
		if (this.#timeoutHandle) clearTimeout(this.#timeoutHandle);
	}
	
	/**
	 * Returns the dirty state of the editor
	 */
	isDirty() {
		return super.isDirty() ? true : (this.#getEditor() ? this.#getEditor().isDirty() : false);
	}

	/**
	 * Set the editor dirty
	 */
	setDirty() {
		super.setDirty();
		
		if (this.#getEditor()) this.#getEditor().setDirty();
		
		this.#updateStatus();
	}
	
	/**
	 * Refresh editor dirty state
	 */
	resetDirtyState() {
		super.resetDirtyState();
		
		if (this.#getEditor()) this.#getEditor().save();
		
		this.#updateStatus();
	}
	
	/**
	 * Hides all option menus for the editor TODO cleanup
	 *
	hideOptions() {
		this._app.hideMenu();
		this._app.hideOptions();
	}
	
	/**
	 * Unloads the editor
	 */
	async unload() {
		var editor = this.#getEditor();
		
		if (editor) {
			editor.setContent("");
			editor.mode.set("readonly");
			editor.destroy();                 // TODO deos this work?
		}
		
		this.setVersionRestoreData(false);
		
		this.#current = null;
		
		this._app.update();  // TODO still necessary?
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
		
		var content = Document.getContent(doc) ? Document.getContent(doc) : '';
		content = this.#convertPlainLinksAndTags(content);
			
		var editorEl = $('<div id="' + this.#editorId + '"></div>');
		this._tab.getContainer().append(
			editorEl		
		);
		
		if (!tinymce.editors.length) {
			editorEl.html(content);
		
			tinymce.init({
				selector: '#' + this.#editorId,  
	            height: '100%',
	            width: '100%',
	            resize : false,
				statusbar: false,
				content_css: 'ui/app/css/RichtextEditor.css',
	            setup: function (editor) {
	                editor.addShortcut('ctrl+s', 'Save', function () {
						that.#saveNote();
	                });
	                
	                editor.on('change', function(e) {
	                	that.#updateStatus();
						that.#updateLinkClickHandlers(editor);
	                	that.#startDelayedSave();
	                });
	                
	                editor.on('input', function(e) {
						that.#updateLinkClickHandlers(editor);
	                	that.#startDelayedSave();
	                });
	                
	                editor.on('click', function(e) {
						that._app.setFocus(Notes.FOCUS_ID_EDITOR);
	                });
					
					editor.on('init', function(e) {
						that._app.setFocus(Notes.FOCUS_ID_EDITOR);
	                });
					
					editor.on('focus', function(e) {
			            that._app.hideOptions();
						that._app.setFocus(Notes.FOCUS_ID_EDITOR);
			        });
					
					editor.on('FullscreenStateChanged', function () {
						// Get rid of mobile keyboard
						if (that._app.device.isTouchAware()) {
							document.activeElement.blur();
						}
					});
					
					that.#setupLinkAutoCompleter(editor);
					that.#updateLinkClickHandlers(editor);
	            },
				plugins: 
					"code table image lists advlist charmap codesample emoticons fullscreen hr imagetools link media print searchreplace toc",  // textpattern
				toolbar: 
					'undo redo | forecolor backcolor removeformat | bold italic underline strikethrough | outdent indent | numlist bullist | formatselect | ' + 
					'alignleft aligncenter alignright alignjustify | pagebreak | fontselect fontsizeselect | emoticons charmap | ' + 
					'insertfile template | ltr rtl | table tabledelete tableprops tablerowprops tablecellprops | fullscreen',
	        });
		} else {
			// The timeout here is a Workaround for the "component not in context" error in tinymce. 
			setTimeout(function() {
				that.#getEditor().mode.set("design");
			}, 10);
		}

		// Check if there is a restore version. If so, load the content into the editor
		if (this.#versionRestoreData) content = this.#versionRestoreData;
		
		// Load the data to the editor and reset all dirty flags
		if (this.#getEditor().getContent() != content) {
			this.#getEditor().setContent(content);
		}
		
		// If we fetched a version, set the editor dirty again
		if (this.#versionRestoreData) {
			this.setDirty();
		} else {
			// The timeout here is a Workaround for the "component not in context" error in tinymce. 
			setTimeout(function() {
				that.resetDirtyState();
			}, 10);
		}

		this.#saveButton = $('<div type="button" data-toggle="tooltip" title="Save Note" class="fa fa-save"></div>');
		this.#discardButton = $('<div type="button" data-toggle="tooltip" title="Discard and Reload Note" class="fa fa-times"></div>');

		// Build buttons
		if (this.#versionRestoreData) {
			this.#versionRestoreMode = true;
			
			this._app.setButtons([ 
				this.#saveButton
				.on('click', function(event) {
					event.stopPropagation();
					that.#saveNote();
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
					that.#saveNote();
				}), 
				
				$('<div type="button" data-toggle="tooltip" title="Note options..." class="fa fa-ellipsis-v"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#callPageOptions(event);
				}), 
			]);			
		}
		
		this.#versionRestoreData = false;
				
		this.#updateStatus();
	}
	
	/**
	 * Returns the tinymce instance
	 */
	#getEditor() {
		return tinymce.get(this.#editorId);
	}
	
	/**
	 * Calls the note options of the tree
	 */
	#callPageOptions(event) {
		event.stopPropagation();
		
		var that = this;
		this._app.showMenu('editorOptions', function(cont) {
			cont.append(
				// Search
				$('<div class="userbutton"></div>').append(
					$('<div class="searchBar"></div>').append(
						$('<input type="text" placeholder="Type text to search..." />')
						.on('focus', function(event) {
							event.stopPropagation();
							that.#getEditor().execCommand('SearchReplace');
							that._app.hideOptions();
						})
					)
				),
			);
			
			cont.append(
				new PageMenu(that._app).get(that, {
					//downloadMimeType: 'text/html',
					//downloadFilename: that.#current.name + '.html' 
				})
			);
		});
	}
	
	/**
	 * Enter fullscreen mode TODO cleanup
	 *
	#fullscreen() {
		this.#getEditor().execCommand('mceFullScreen');
	}
	
	/**
	 * Trigger saving the note (called by buttons)
	 */
	#saveNote() {
		if (this.isDirty()) {
			this.stopDelayedSave();
			
			this._app.showAlert("Saving " + this.#current.name + "...", "I", "SaveMessages");
			
			this.#convertContentLinksAndTags();
			
			var that = this;
			return this._app.actions.document.save(this.#current._id, this.getContent())
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
		//$('#saveButton').toggleClass("buttonDisabled", !this.isDirty())
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
			
			that.#convertContentLinksAndTags();
			
			that._app.actions.document.save(that.getCurrentId(), that.getContent())
			.catch(function(err) {
        		that._app.showAlert((!err.abort ? 'Error: ' : '') + err.message, err.abort ? 'I' : "E", err.messageThreadId);
        	});
		}, secs * 1000);
	}
	
	/**
	 * Init the link auto completion.
	 */
	#setupLinkAutoCompleter(editor) {
		var that = this;
		
		/**
	     * Auto completer for in-document links to other documents.
	     */
	    editor.ui.registry.addAutocompleter('addlink', {
			ch: Linkage.startChar,
			minChars: 0,
			columns: 1,
			highlightOn: ['char_name'],
			
			onAction: function(autocompleteApi, rng, value) {
				that.#onAutoCompleteAction(editor, autocompleteApi, rng, value);
			},
			
			fetch: function (pattern) {
				return that.#fetchLinkAutoCompletion(editor, pattern);
			},
			
			matches: function(rng, text, pattern) {
				return that.#doTriggerLinkAutoCompletion(editor, rng, text, pattern);
			}
		});

		/**
	     * Auto completer for hash tags
	     */
	    editor.ui.registry.addAutocompleter('addHashtag', {
			ch: Hashtag.startChar,
			minChars: 0,
			columns: 1,
			highlightOn: ['char_name'],
			
			onAction: function(autocompleteApi, rng, value) {
				that.#onAutoCompleteAction(editor, autocompleteApi, rng, value);
			},
			fetch: function (pattern) {
				return that.#fetchTagAutoCompletion(editor, pattern);
			},
			matches: function(rng, text, pattern) {
				return that.#doTriggerTagAutoCompletion(editor, rng, text, pattern);
			}
		});
	}
	
	/**
	 * Returns if the auto completion shall be triggered. This is the case if the last char before the trigger char is [.
	 */
	#doTriggerLinkAutoCompletion(editor, rng, text, pattern) {
		var lastChar = text.substring(rng.startOffset-1, rng.startOffset);
		return (lastChar == Linkage.startChar);
	}
	
	/**
	 * Returns if the auto completion shall be triggered. This is the case if the last char before the trigger char is [.
	 */
	#doTriggerTagAutoCompletion(editor, rng, text, pattern) {
		return true;
	}
	
	/**
	 * Returns a TinyMCE Promise wchich returns the list in the TinyMCE auto completer format.
	 */
	#fetchLinkAutoCompletion(editor, pattern) {
		var that = this;
		
		return new tinymce.util.Promise(function (resolve) {
			resolve(that.#getLinkAutocompleteMatchedChars(editor, pattern).map(function (char) {
				return {
					type: 'cardmenuitem',
					value: Linkage.startTagRest + char.id + (char.displayText ? (Linkage.separator + char.displayText) : '') + Linkage.endTag,
					label: char.text,
					items: [
						{
							type: 'cardcontainer',
							direction: 'vertical',
							items: [
								{
									type: 'cardtext',
									text: char.text,
									name: 'char_name'
								}
							]
						}
					]
				}
			}));
		});
	}
	
	/**
	 * Returns a TinyMCE Promise wchich returns the list in the TinyMCE auto completer format.
	 */
	#fetchTagAutoCompletion(editor, pattern) {
		var that = this;
		
		return new tinymce.util.Promise(function (resolve) {
			resolve(that.#getTagAutocompleteMatchedChars(editor, pattern).map(function (char) {
				const classes = [that._app.hashtag.getListStyleClass(char.id)];
				
				return {
					type: 'cardmenuitem',
					value: Hashtag.startChar + char.id + ' ',
					label: char.text,
					items: [
						{
							type: 'cardcontainer',
							direction: 'vertical',
							items: [
								{
									type: 'cardtext',
									text: Hashtag.startChar + char.text,
									name: 'char_name',
									classes: classes
								}
							]
						}
					]
				}
			}));
		});
	}
	
	/**
	 * Called to perform the text replacement when the user chooses an auto complete option (links).
	 */
	#onAutoCompleteAction(editor, autocompleteApi, rng, value) {
		// Insert the text
		editor.selection.setRng(rng);
		editor.insertContent(value);
		
		// Hide auto complete dialog
		autocompleteApi.hide();
		
		// Convert all links to spans
		this.#convertContentLinksAndTags();		
		
		// Update click handlers
		this.#updateLinkClickHandlers(editor);
	}
	
	/**
	 * Returns the list of proposals for link auto completion.
	 */
	#getLinkAutocompleteMatchedChars(editor, pattern) {	
		return this._app.data.getLinkAutocompleteList(pattern);
	}
	
	/**
	 * Returns the list of proposals for link auto completion.
	 */
	#getTagAutocompleteMatchedChars(editor, pattern) {
		return this._app.data.getTagAutocompleteList(pattern);
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Updates the content replacing all links and tags.
	 */
	#convertContentLinksAndTags() {
		var content = this.getContent();
		
		// Convert links and tags. If nothing changed, quit.
		var converted = this.#convertPlainLinksAndTags(content);
		if (content == converted) return;

		// Set the new content on the editor
		this.#getEditor().setContent(converted);
		
		// Restore cursor position
		this.#setCursorAfterNode(this.#cursorElementId);
	}
	
	/**
	 * Sets the cursor in the editor one step after the end of the DOM element with the passed ID.
	 */
	#setCursorAfterNode(id) {
		var cursorNode = this.#getEditor().dom.select('#' + id);
		
		var sel = this.#getEditor().selection;
		var rng = sel.getRng();

		// Set after the element which has last been replaced
		rng.setStartAfter(cursorNode[0]);
		rng.setEndAfter(cursorNode[0]);
		
		// Advance the cursor by one step to get outside the element.
		rng.setStart(rng.startContainer, rng.startOffset + 1);
		sel.setRng(rng);
	}
	
	/**
	 * Replaces all plain links ([[]]) and hashtags to HTML with click handlers, if not yet converted.
	 */
	#convertPlainLinksAndTags(content) {
		// This will hold the DOM ID of the last created link or tag element for 
		// later cursor positioning, after conversion of links and tags.
		this.#cursorElementId = false;
		
		if (!this._app.state.getEditorSettings().dontReplaceLinksInRTEditor) content = this.#convertPlainLinks(content);
		if (!this._app.state.getEditorSettings().dontReplaceTagsInRTEditor) content = this.#convertPlainTags(content);
		return content;
	}
	
	/**
	 * Replaces all plain links ([[]]) to HTML with click handlers, if not yet converted. If
	 * an already converted link is found, it will be checked for correctness and updated to match
	 * the data-link tag again, if necessary.
	 *    
	 * Link format is: 
	 *    
	 *   [[Target|Text]] 
	 *    
	 * is converted to 
	 *    
	 *   <span class="notesTMCELink" data-ref="Target" data-link="[[Target|Text]]">Text</span>
	 *
	 */
	#convertPlainLinks(content) {
		var dom = $('<div>' + content + '</div>');
		var cnt = 0;
		var that = this;
		
		dom.find('*')
		.not('span.' + RichtextEditor.#linkClass)
		.each(function() {
			var el = $(this);
			
			var repl = [];
			el.contents()
			.filter(function() { 
				return this.nodeType == 3; 
			})
			.each(function() {
				var textNode = this;
				var text = textNode.nodeValue;
				
				const coll = Linkage.parse(text);
				if (coll.length == 0) return;
			
				for(var c=0; c<coll.length; ++c) {
					repl.push(coll[c]);
				}
			});

			if (repl.length == 0) return;

			var html = el.html();
			for(var c=0; c<repl.length; ++c) {
				const co = repl[c];
				const meta = Linkage.splitLink(co.link);
				if (!meta) {
					console.log("Invalid link ignored: " + co.link);
					continue;	
				}
				const link = that.#createLinkElement(meta.target, meta.text);
				
				html = html.replaceAll(co.orig, link);
				cnt++;
			}
			$(this).html(html);
		});
		
		if (cnt > 0) {
			console.log(' -> Editor: Replaced ' + cnt + ' raw links with HTML');
			
			return dom.html();
		} else {
			return content;			
		}
	}
	
	/**
	 * Replaces all plain hashtags (#) to HTML with click handlers, if not yet converted. If
	 * an already converted tag is found, it will be checked for correctness and updated to match
	 * the data-tag tag again, if necessary.
	 *    
	 * Hashtag format is: 
	 *    
	 *   #Tagname 
	 *    
	 * is converted to 
	 *    
	 *   <span class="notesTMCETag">#Tagname</span>
	 *
	 */
	#convertPlainTags(content) {
		var dom = $('<div>' + content + '</div>');
		var cnt = 0;
		var that = this;
		
		dom.find('*')
		.not('span.' + RichtextEditor.#tagClass)
		.each(function() {
			var el = $(this);
			
			var repl = [];
			el.contents()
			.filter(function(){ 
				return this.nodeType == 3; 
			})
			.each(function() {
				var textNode = this;
				var text = textNode.nodeValue;
				const coll = that._app.hashtag.parse(text);
				if (coll.length == 0) return;
			
				for(var c=0; c<coll.length; ++c) {
					repl.push(coll[c]);
				}
			});

			if (repl.length == 0) return;

			var html = el.html();
			for(var c=0; c<repl.length; ++c) {
				const co = repl[c];
				const tag = that.#createTagElement(co.tag);
				html = html.replaceAll(co.orig, tag);
				cnt++;
			}
			$(this).html(html);
		});
		
		if (cnt > 0) {
			if (cnt > 0) console.log(' -> Editor: Replaced ' + cnt + ' raw hashtags with HTML');
			
			return dom.html();
		} else {
			return content;			
		}
	}
	
	/**
	 * Re-sets all onclick handlers for the internal links.
	 */
	#updateLinkClickHandlers(editor) {
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
			if (!editor) return;
			if (!editor.contentDocument) return;
			
			const links = editor.contentDocument.getElementsByClassName(RichtextEditor.#linkClass);
			for (var i=0; i<links.length; ++i) {
				links[i].removeEventListener("click", linkClick);
				links[i].addEventListener("click", linkClick);
			}
			
			const tags = editor.contentDocument.getElementsByClassName(RichtextEditor.#tagClass);
			for (var i=0; i<tags.length; ++i) {
				tags[i].removeEventListener("click", tagClick);
				tags[i].addEventListener("click", tagClick);
				
				// Colors
				const tag = that._app.hashtag.extractTagFromElement($(tags[i]));
				const tagColor = that._app.hashtag.getColor(tag);
				if (tag) $(tags[i]).css('background-color', tagColor);
				if (tag) $(tags[i]).css('color', Tools.getForegroundColor(tagColor));
			}
		}, 0);
	}

	/**
	 * Generates a link span HTML. Returns a string.
	 */
	#createLinkElement(target, text) {
		if (!this.#cursorElementSeed) this.#cursorElementSeed = 1;
		
		this.#cursorElementId = Tools.getUuid(this.#cursorElementSeed++);
		
		return '<span id="' + this.#cursorElementId + '" class="' + RichtextEditor.#linkClass + '" data-ref="' + target + '" data-link="' + Linkage.composeLink(target, text) + '">' + (text ? text : target) + '</span>&nbsp;';
	}
	
	/**
	 * Generates a tag span HTML. Returns a string.
	 */
	#createTagElement(target) {
		if (!this.#cursorElementSeed) this.#cursorElementSeed = 1;
		
		this.#cursorElementId = Tools.getUuid(this.#cursorElementSeed++);
		
		return '<span id="' + this.#cursorElementId + '" class="' + RichtextEditor.#tagClass + '">' + Hashtag.startChar + target + '</span>&nbsp;';
	}
	
	/**
	 * Click handler for internal links.
	 */
	#onLinkClick(event) {
		if (!event.currentTarget) return;
		
		const ref = $(event.currentTarget).data('ref');
		if (!ref) return;
		
		this._callDocument(ref.trim());
	}
	
	/**
	 * Click handler for hashtags.
	 */
	#onTagClick(event) {
		if (!event.currentTarget) return;
		
		const tag = this._app.hashtag.extractTagFromElement($(event.currentTarget)); //.text();
		if (!tag) return;
		
		if (event.ctrlKey || event.metaKey) {
			const currentId = this.getCurrentId();
			this._app.routing.callHashtags(currentId);
		} else {
			this._app.hashtag.showTag(tag);
		}
	}
}

