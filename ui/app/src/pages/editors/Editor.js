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
class Editor {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Editor.instance) Editor.instance = new Editor();
		return Editor.instance;
	}
	
	static linkClass = 'notesTMCELink';       ///< Class for the internal links
	
	constructor() {
		this.editorId = "editorContent";
	}
	
	/**
	 * Tells if the editor needs tree data loaded before load() is called.
	 */
	needsTreeData() {
		return false;
	}
	
	/**
	 * Returns the DOM elements for the editor.
	 */
	getContainerDom(teaser) {
		return $('<div id="editor" class="mainPanel"/>').append( 
			$('<div id="editorContent"></div>').append(teaser),
		);
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	load(doc) {
		var that = this;
		var n = Notes.getInstance();
		
		Document.brokenLinksWarning(doc);
		
		var content = '';
		if (Document.getContent(doc)) content = Document.getContent(doc);
		content = this.convertPlainLinks(content);
			
		this.setCurrent(doc);
		n.setCurrentEditor(this);
		n.setCurrentPage(this);
		
		$('#contentContainer').hide();
		$('#editor').show();
		
		if (!tinymce.editors.length) {
			$('#' + this.editorId).html(content);
		
			tinymce.init({
				selector: '#' + this.editorId,  
	            height: '100%',
	            width: '100%',
	            resize : false,
				statusbar: false,
				content_css: 'ui/app/css/Editor.css',
	            setup: function (editor) {
	                editor.addShortcut('ctrl+s', 'Save', function () {
						that.saveNote();
	                });
	                editor.on('change', function(e) {
	                	that.updateStatus();
						that.updateLinkClickHandlers(editor);
	                	that.startDelayedSave();
	                    
	                });
	                editor.on('input', function(e) {
						that.updateLinkClickHandlers(editor);
	                	that.startDelayedSave();
	                });
	                editor.on('click', function(e) {
	                	Notes.getInstance().update();
	                });
					editor.on('init', function(e) {
	                	//if (doFocus) {
						//	Editor.getInstance().fullscreen();
						//}
	                });
					editor.on('focus', function(e) {
			            that.hideOptions();
			        });
					editor.on('FullscreenStateChanged', function () {
						// Get rid of mobile keyboard
						if (Notes.getInstance().isMobile()) {
							document.activeElement.blur();
						}
					});
					
					that.setupLinkAutoCompleter(editor);
					that.updateLinkClickHandlers(editor);
	            },
				plugins: 
					"code table image lists advlist charmap codesample emoticons fullscreen hr imagetools link media print searchreplace textpattern toc",
				toolbar: 
					'undo redo | forecolor backcolor removeformat | bold italic underline strikethrough | outdent indent | numlist bullist | formatselect | ' + 
					'alignleft aligncenter alignright alignjustify | pagebreak | fontselect fontsizeselect | emoticons charmap | ' + 
					'insertfile template | ltr rtl | table tabledelete tableprops tablerowprops tablecellprops | fullscreen',
	        });
		} else {
			// The timeout here is a Workaround for the "component not in context" error in tinymce. 
			setTimeout(function() {
				tinymce.get(that.editorId).mode.set("design");
			}, 10);
		}

		// Check if there is a restore version. If so, load the content into the editor
		if (this.versionRestoreData) content = this.versionRestoreData;
		
		// Load the data to the editor and reset all dirty flags
		if (tinymce.get(this.editorId).getContent() != content) {
			tinymce.get(this.editorId).setContent(content);
		}
		
		// If we fetched a version, set the editor dirty again
		if (this.versionRestoreData) {
			this.setDirty();
		} else {
			// The timeout here is a Workaround for the "component not in context" error in tinymce. 
			setTimeout(function() {
				Editor.getInstance().resetDirtyState();
			}, 10);
		}

		// Build buttons
		if (this.versionRestoreData) {
			this.versionRestoreMode = true;
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Save Note" id="saveButton" class="fa fa-save" onclick="event.stopPropagation();Editor.getInstance().saveNote();"></div>'),
				$('<div type="button" data-toggle="tooltip" title="Discard and Reload Note" id="discardButton" class="fa fa-times" onclick="event.stopPropagation();Editor.getInstance().discard(true);"></div>'),
			]);
		} else {
			this.versionRestoreMode = false;
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Save Note" id="saveButton" class="fa fa-save" onclick="event.stopPropagation();Editor.getInstance().saveNote();"></div>'), 
				$('<div type="button" data-toggle="tooltip" title="Note options..." id="editorOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();Editor.getInstance().callOptions(event);"></div>'), 
			]);			
		}
		
		this.versionRestoreData = false;
				
		this.updateStatus();
		
		return Promise.resolve();
	}
	
	getType() {
		return 'note';
	}
	
	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'richtext';
	}
	
	/**
	 * Remembers the currently loaded note data in this.current. Also adjusts the loaded note text etc.
	 */
	setCurrent(data) {
		this.current = data;

		var n = Notes.getInstance();
		
		var txt = "";
		if (data) txt = data.name + (n.isMobile() ? "" : " (" + new Date(data.timestamp).toLocaleString() + ")");

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
				// Search
				$('<div class="userbutton"></div>').append(
					$('<div class="searchBar"></div>').append(
						$('<input type="text" id="editorSearch" placeholder="Type text to search..." />')
						.on('focus', function(event) {
							event.stopPropagation();
							tinymce.get(that.editorId).execCommand('SearchReplace');
							that.hideOptions();
						})
					)
				),
			);
			
			cont.append(
				PageMenu.get(that, {
					//downloadMimeType: 'text/html',
					//downloadFilename: that.current.name + '.html' 
				})
			);
		});
	}
	
	/**
	 * Hides all option menus for the editor
	 */
	hideOptions() {
		Notes.getInstance().hideMenu();
		Notes.getInstance().hideOptions();
	}
	
	/**
	 * Enter fullscreen mode
	 */
	fullscreen() {
		tinymce.get(this.editorId).execCommand('mceFullScreen');
	}
	
	/**
	 * Trigger saving the note (called by buttons)
	 */
	saveNote() {
		if (this.isDirty()) {
			this.stopDelayedSave();
			
			var n = Notes.getInstance();
			n.showAlert("Saving " + this.current.name + "...", "I", "SaveMessages");
			
			var that = this;
			return DocumentActions.getInstance().save(this.current._id, this.convertPlainLinks(this.getContent()))
			.then(function(data) {
        		if (data.message) n.showAlert(data.message, "S", data.messageThreadId);

				if (that.versionRestoreMode) {
					n.routing.refresh();
				}
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
	 * Reloads the content from the server, discarding the contents.
	 */
	discard(removeButton) {
		this.setVersionRestoreData(false);
		
		if (removeButton) $('#discardButton').css("display", "none");
		
		var n = Notes.getInstance();
		n.showAlert("Action cancelled.", "I");

		//location.reload();
		n.routing.call("history/" + this.getCurrentId());
	}
	
	/**
	 * Sets data to be loaded into the editor instead of the passed data in load().
	 */
	setVersionRestoreData(data) {
		this.versionRestoreData = data;
	}
	
	/**
	 * Returns if the editor is in restore mode.
	 */
	getRestoreMode() {
		return !!this.versionRestoreMode;
	}
	
	/**
	 * Return current HTML content of the editor.
	 */
	getContent() {
		return tinymce.get(this.editorId).getContent();
	}
	
	/**
	 * Unloads the editor
	 */
	unload() {
		var n = Notes.getInstance();
		
		if (tinymce.get(this.editorId)) {
			tinymce.get(this.editorId).setContent("");
			tinymce.get(this.editorId).mode.set("readonly");
		}
		
		this.setCurrent();

		this.setVersionRestoreData(false);
		this.resetDirtyState();
		
		n.update();
	}
	
	/**
	 * Returns the dirty state of the editor
	 */
	isDirty() {
		return this.dirty ? true : (tinymce.get(this.editorId) ? tinymce.get(this.editorId).isDirty() : false);
	}

	/**
	 * Set the editor dirty
	 */
	setDirty() {
		this.dirty = true;
		if (tinymce.get(this.editorId)) tinymce.get(this.editorId).setDirty();
		this.updateStatus();
	}
	
	/**
	 * Refresh editor dirty state
	 */
	resetDirtyState() {
		this.dirty = false;
		if (tinymce.get(this.editorId)) tinymce.get(this.editorId).save();
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
			if (!tinymce.get(that.editorId).isDirty()) return;
			
			DocumentActions.getInstance().save(that.getCurrentId(), that.convertPlainLinks(that.getContent()))
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
	 * Init the link auto completion.
	 */
	setupLinkAutoCompleter(editor) {
		var that = this;
		
		/**
	     * An autocompleter that allows you to insert special characters.
	     * Items are built using the CardMenuItem.
	     */
	    editor.ui.registry.addAutocompleter('addlink', {
			ch: Linkage.startChar,
			minChars: 0,
			columns: 1,
			highlightOn: ['char_name'],
			onAction: function(autocompleteApi, rng, value) {
				that.onLinkAutoCompleteAction(editor, autocompleteApi, rng, value);
			},
			fetch: function (pattern) {
				return that.fetchLinkAutoCompletion(editor, pattern);
			},
			matches: function(rng, text, pattern) {
				return that.doTriggerLinkAutoCompletion(editor, rng, text, pattern);
			}
		});
	}
	
	/**
	 * Returns if the auto completion shall be triggered. This is the case if the last char before the trigger char is [.
	 */
	doTriggerLinkAutoCompletion(editor, rng, text, pattern) {
		var lastChar = text.substring(rng.startOffset-1, rng.startOffset);
		return (lastChar == Linkage.startChar);
	}
	
	/**
	 * Returns a TinyMCE Promise wchich returns the list in the TinyMCE auto completer format.
	 */
	fetchLinkAutoCompletion(editor, pattern) {
		var that = this;
		
		return new tinymce.util.Promise(function (resolve) {
			resolve(that.getLinkAutocompleteMatchedChars(editor, pattern).map(function (char) {
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
	 * Called to perform the text replacement when the user chooses an auto complete option.
	 */
	onLinkAutoCompleteAction(editor, autocompleteApi, rng, value) {
		// Insert the text
		editor.selection.setRng(rng);
		editor.insertContent(value);
		
		// Hide auto complete dialog
		autocompleteApi.hide();
		
		// Convert all links to spans
		tinymce.get(this.editorId).setContent(this.convertPlainLinks(this.getContent()));		
		
		// Update click handlers
		this.updateLinkClickHandlers(editor);
	}
	
	/**
	 * Returns the list of proposals for link aut completion.
	 */
	getLinkAutocompleteMatchedChars(editor, pattern) {
		return Notes.getInstance().getData().getAutocompleteList(pattern);
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////
	
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
	convertPlainLinks(content) {
		const coll = Linkage.parse(content, '"');
		
		if (coll.length == 0) return content;
		
		console.log(' -> Replacing ' + coll.length + ' raw links with HTML');
		
		for(var c=0; c<coll.length; ++c) {
			const co = coll[c];
			const meta = Linkage.splitLink(co.link);
			if (!meta) {
				console.log("Invalid link ignored: " + co.link);
				continue;	
			}
			const link = this.createLinkElement(meta.target, meta.text);
			
			content = content.replaceAll(Linkage.startTag + co.link + Linkage.endTag, link);
		}
		
		return content;
	}
	
	/**
	 * Re-sets all onclick handlers for the internal links.
	 */
	updateLinkClickHandlers(editor) {
		var that = this;
		setTimeout(function() {
			const links = editor.contentDocument.getElementsByClassName(Editor.linkClass);
			for (var i=0; i<links.length; ++i) {
				links[i].removeEventListener("click", that.onLinkClick);
				links[i].addEventListener("click", that.onLinkClick);
			}
		}, 0);
	}

	/**
	 * Generates a link span HTML. Returns a string.
	 */
	createLinkElement(target, text) {
		return '<span class="' + Editor.linkClass + '" data-ref="' + target + '" data-link="' + Linkage.composeLink(target, text) + '">' + (text ? text : target) + '</span>';
	}
	
	/**
	 * Click handler for internal links.
	 */
	onLinkClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		if (!event.currentTarget) return;
		
		const ref = $(event.currentTarget).data('ref');
		if (!ref) return;
		
		//NoteTree.getInstance().openNode(ref);
		Notes.getInstance().routing.call(ref);
	}
}

