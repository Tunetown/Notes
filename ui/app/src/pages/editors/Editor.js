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
	static tagClass = 'notesTMCETag';         ///< Class for the hashtags
	
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
		content = this.convertPlainLinksAndTags(content);
			
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
					"code table image lists advlist charmap codesample emoticons fullscreen hr imagetools link media print searchreplace toc",  // textpattern
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
			
			this.convertContentLinksAndTags();
			
			var that = this;
			return DocumentActions.getInstance().save(this.current._id, this.getContent())
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
			
			that.convertContentLinksAndTags();
			
			DocumentActions.getInstance().save(that.getCurrentId(), that.getContent())
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
	     * Auto completer for in-document links to other documents.
	     */
	    editor.ui.registry.addAutocompleter('addlink', {
			ch: Linkage.startChar,
			minChars: 0,
			columns: 1,
			highlightOn: ['char_name'],
			onAction: function(autocompleteApi, rng, value) {
				that.onAutoCompleteAction(editor, autocompleteApi, rng, value);
			},
			fetch: function (pattern) {
				return that.fetchLinkAutoCompletion(editor, pattern);
			},
			matches: function(rng, text, pattern) {
				return that.doTriggerLinkAutoCompletion(editor, rng, text, pattern);
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
				that.onAutoCompleteAction(editor, autocompleteApi, rng, value);
			},
			fetch: function (pattern) {
				return that.fetchTagAutoCompletion(editor, pattern);
			},
			matches: function(rng, text, pattern) {
				return that.doTriggerTagAutoCompletion(editor, rng, text, pattern);
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
	 * Returns if the auto completion shall be triggered. This is the case if the last char before the trigger char is [.
	 */
	doTriggerTagAutoCompletion(editor, rng, text, pattern) {
		return true;
	}
	
	/**
	 * Returns a TinyMCE Promise wchich returns the list in the TinyMCE auto completer format.
	 */
	fetchLinkAutoCompletion(editor, pattern) {
		var that = this;
		
		return new tinymce.util.Promise(function (resolve) {
			resolve(that.getLinkAutocompleteMatchedChars(editor, pattern).map(function (char) {
				//const classes = [Linkage.getListStyleClass(char.id)];
				
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
	fetchTagAutoCompletion(editor, pattern) {
		var that = this;
		
		return new tinymce.util.Promise(function (resolve) {
			resolve(that.getTagAutocompleteMatchedChars(editor, pattern).map(function (char) {
				const classes = [Hashtag.getListStyleClass(char.id)];
				
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
	onAutoCompleteAction(editor, autocompleteApi, rng, value) {
		// Insert the text
		editor.selection.setRng(rng);
		editor.insertContent(value);
		
		// Hide auto complete dialog
		autocompleteApi.hide();
		
		// Convert all links to spans
		this.convertContentLinksAndTags();		
		
		// Update click handlers
		this.updateLinkClickHandlers(editor);
	}
	
	/**
	 * Returns the list of proposals for link auto completion.
	 */
	getLinkAutocompleteMatchedChars(editor, pattern) {	
		return Notes.getInstance().getData().getLinkAutocompleteList(pattern);
	}
	
	/**
	 * Returns the list of proposals for link auto completion.
	 */
	getTagAutocompleteMatchedChars(editor, pattern) {
		return Notes.getInstance().getData().getTagAutocompleteList(pattern);
	}
	
	////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Updates the content replacing all links and tags.
	 */
	convertContentLinksAndTags() {
		var content = this.getContent();
		
		// Convert links and tags. If nothing changed, quit.
		var converted = this.convertPlainLinksAndTags(content);
		if (content == converted) return;

		// Set the new content on the editor
		tinymce.get(this.editorId).setContent(converted);
		
		// Restore cursor position
		this.setCursorAfterNode(this.cursorElementId);
	}
	
	/**
	 * Sets the cursor in the editor one step after the end of the DOM element with the passed ID.
	 */
	setCursorAfterNode(id) {
		var cursorNode = tinymce.get(this.editorId).dom.select('#' + id);
		
		var sel = tinymce.get(this.editorId).selection;
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
	convertPlainLinksAndTags(content) {
		// This will hold the DOM ID of the last created link or tag element for 
		// later cursor positioning, after conversion of links and tags.
		this.cursorElementId = false;
		
		if (!ClientState.getInstance().getEditorSettings().dontReplaceLinksInRTEditor) content = this.convertPlainLinks(content);
		if (!ClientState.getInstance().getEditorSettings().dontReplaceTagsInRTEditor) content = this.convertPlainTags(content);
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
	convertPlainLinks(content) {
		var dom = $('<div>' + content + '</div>');
		var that = this;
		var cnt = 0;
		dom.find('*').not('span.' + Editor.linkClass).each(function() {
			var el = $(this);
			
			var repl = [];
			el.contents().filter(function(){ 
				return this.nodeType == 3; 
			}).each(function() {
				var textNode = this;
				var text = textNode.nodeValue;
				const coll = Linkage.parse(text);
				//console.log(text + ' ' + coll.length);
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
				const link = that.createLinkElement(meta.target, meta.text);
				
				html = html.replaceAll(co.orig, link);
				cnt++;
				//console.log('   -> Replaced ' + co.orig + ' with ' + tag);
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
	convertPlainTags(content) {
		var dom = $('<div>' + content + '</div>');
		var that = this;
		var cnt = 0;
		dom.find('*').not('span.' + Editor.tagClass).each(function() {
			var el = $(this);
			
			var repl = [];
			el.contents().filter(function(){ 
				return this.nodeType == 3; 
			}).each(function() {
				var textNode = this;
				var text = textNode.nodeValue;
				const coll = Hashtag.parse(text);
				//console.log(text + ' ' + coll.length);
				if (coll.length == 0) return;
			
				for(var c=0; c<coll.length; ++c) {
					repl.push(coll[c]);
				}
			});

			if (repl.length == 0) return;

			var html = el.html();
			for(var c=0; c<repl.length; ++c) {
				const co = repl[c];
				const tag = that.createTagElement(co.tag);
				html = html.replaceAll(co.orig, tag);
				cnt++;
				//console.log('   -> Replaced ' + co.orig + ' with ' + tag);
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
	updateLinkClickHandlers(editor) {
		var that = this;
		
		setTimeout(function() {
			const links = editor.contentDocument.getElementsByClassName(Editor.linkClass);
			for (var i=0; i<links.length; ++i) {
				links[i].removeEventListener("click", that.onLinkClick);
				links[i].addEventListener("click", that.onLinkClick);
			}
			
			const tags = editor.contentDocument.getElementsByClassName(Editor.tagClass);
			for (var i=0; i<tags.length; ++i) {
				tags[i].removeEventListener("click", that.onTagClick);
				tags[i].addEventListener("click", that.onTagClick);
				
				// Colors
				const tag = Editor.extractTagFromElement($(tags[i]));
				const tagColor = Hashtag.getColor(tag);
				if (tag) $(tags[i]).css('background-color', tagColor);
				if (tag) $(tags[i]).css('color', Tools.getForegroundColor(tagColor));
			}
		}, 0);
	}

	/**
	 * Generates a link span HTML. Returns a string.
	 */
	createLinkElement(target, text) {
		if (!this.cursorElementSeed) this.cursorElementSeed = 1;
		this.cursorElementId = Tools.getUuid(this.cursorElementSeed++);
		return '<span id="' + this.cursorElementId + '" class="' + Editor.linkClass + '" data-ref="' + target + '" data-link="' + Linkage.composeLink(target, text) + '">' + (text ? text : target) + '</span>&nbsp;';
	}
	
	/**
	 * Generates a tag span HTML. Returns a string.
	 */
	createTagElement(target) {
		if (!this.cursorElementSeed) this.cursorElementSeed = 1;
		this.cursorElementId = Tools.getUuid(this.cursorElementSeed++);
		return '<span id="' + this.cursorElementId + '" class="' + Editor.tagClass + '">' + Hashtag.startChar + target + '</span>&nbsp;';
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
		
		Editor.callDocument(ref.trim());
	}
	
	/**
	 * Click handler for hashtags.
	 */
	onTagClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		if (!event.currentTarget) return;
		
		const tag = Editor.extractTagFromElement($(event.currentTarget)); //.text();
		if (!tag) return;
		
		if (event.ctrlKey) {
			const currentId = Editor.getInstance().getCurrentId();
			Notes.getInstance().routing.callHashtags(currentId);
		} else {
			Hashtag.showTag(Hashtag.trim(tag));
		}
	}
	
	/**
	 * Extracts the tag name from a JQuery element's text content.
	 */
	static extractTagFromElement(el) {
		var tag = el.text();
		if (tag.substring(0, Hashtag.startChar.length) != Hashtag.startChar) return false;
		if (!tag) return false;
		
		return tag.substring(Hashtag.startChar.length).trim();
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Used by all editors to call in-document linked items.
	 */
	static callDocument(id) {
		NoteTree.getInstance().setSearchText('');
		Notes.getInstance().routing.call(id);
	}
}

