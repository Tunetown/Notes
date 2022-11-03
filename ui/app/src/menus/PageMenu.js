/**
 * Page menu.
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
class PageMenu { 
	
	/**
	 * Generates the options for the different editors. Returns an array holding the options divs.
	 */
	static get(editor, options) {
		var n = Notes.getInstance();
		
		if (!options) options = {};
		
		if (n.isMobile()) options.noOpenInNavigation = true;
		if (!editor.getEditorMode || !editor.getEditorMode()) options.noEditorModeSwitch = true;
		
		//var openedDoc = editor.current;
		var openedDoc = n.getData().getById(editor.getCurrentId());
		
		return [
			// Editor mode
			options.noEditorModeSwitch ? null : $('<div class="userbutton"></div>').append(
				Document.getEditorModeSelector(editor.getEditorMode(), {
					prefix: 'Editor: ',
					cssClass: 'userbuttonselect'
				})
				.on('change', function(event) {
					event.stopPropagation();
					editor.hideOptions();
					
					// Change board mode
					EditorActions.getInstance().saveEditorMode(editor.getCurrentId(), this.value)
					.then(function(data) {
						n.routing.call(editor.getCurrentId());
					})
					.catch(function(err) {
						n.showAlert('Error: '+ err.message, "E", err.messageThreadId);
					});
				})
				.on('click', function(event) {
					event.stopPropagation();
				})
			),
			
			$('<div class="userbuttonLine"></div>'),
			
			// Star
			options.noStar ? null : $('<div class="userbutton"><div id="pageMenuStarOptionIcon" class="fa fa-star userbuttonIcon" style="color: ' + ((openedDoc && openedDoc.star) ? '#c40cf7' : 'black') + ';"></div><span id="pageMenuStarOptionText">' + ((openedDoc && openedDoc.star) ? 'Unpin from' : 'Pin to') + ' Favorites</span></div>')
			.on('click', function(event) {
				event.stopPropagation();
				//editor.hideOptions();
				if (!openedDoc) return;
				
				function updateMenuItem(starred) {
					$('#pageMenuStarOptionIcon').css('color', starred ? '#c40cf7' : 'black');
					$('#pageMenuStarOptionText').text((starred ? 'Unpin from' : 'Pin to') + ' Favorites');
				}
				
				var newState = !openedDoc.star;
				DocumentActions.getInstance().setStarFlag(openedDoc._id, newState)
				.then(function(data) {
					updateMenuItem(newState);
				})
				.catch(function(err) {
					n.showAlert(err.message ? err.message : 'Error setting star flag for item.', err.abort ? 'I' : 'E', err.messageThreadId);
				});			
			}),
			
			// Share
			options.noShare ? null : $('<div class="userbutton"><div class="fa fa-share-square userbuttonIcon"></div>Share</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();
				
				try {
					navigator.share({
						title: editor.current.name,
						url: location.href
					});
  
  				} catch (err) {
  					n.showAlert('Error sharing content, perhaps your browser does not support this feature yet.', 'W');
  				}
			}),
			
			// Create
			options.noCreate ? null : $('<div class="userbutton"><div class="fa fa-plus userbuttonIcon"></div>Create</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				DocumentActions.getInstance().create(editor.getCurrentId())
				.then(function(data) {
					if (data.message) {
						n.showAlert(data.message, "S", data.messageThreadId);
					}
				})
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
				});
			}),
			
			// Rename
			options.noRename ? null : $('<div class="userbutton"><div class="fa fa-pencil-alt userbuttonIcon"></div>Rename</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				DocumentActions.getInstance().renameItem(editor.getCurrentId())
				.then(function(data) {
					if (data.message) {
						n.showAlert(data.message, "S", data.messageThreadId);
					}
					n.routing.call(editor.getCurrentId());
				})
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
			}),
			
			// Move
			options.noMove ? null : $('<div class="userbutton"><div class="fa fa-arrows-alt userbuttonIcon"></div>Move</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	DocumentActions.getInstance().moveItems([editor.getCurrentId()])
	        	.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
	        }),
	        
	        // Copy
	        options.noCopy ? null : $('<div class="userbutton"><div class="fa fa-copy userbuttonIcon"></div>Copy</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	DocumentActions.getInstance().copyItem(editor.getCurrentId())
	        	.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
	        }),
	        
	        // Delete
	        options.noDelete ? null : $('<div class="userbutton"><div class="fa fa-trash userbuttonIcon"></div>Delete</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();	
	        	
	        	var delId = editor.getCurrentId();
	        	
	        	n.showAlert("Preparing to delete item...", 'I', 'DeleteMessages');
	        	DocumentActions.getInstance().deleteItems([delId])
				.then(function(data) {
	        		if (data.message) {
	        			n.showAlert(data.message, "S", data.messageThreadId);
	        		}
	        		n.routing.call();
	        	})
				.catch(function(err) {
	        		n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
	        		n.routing.call(delId);
	        	});
	        }),
	        
	        $('<div class="userbuttonLine"></div>'),
	        
	        // Labels
	        options.noLabelDefinitions ? null : $('<div class="userbutton"><div class="fa fa-tags userbuttonIcon"></div>Labels</div>')
	        .append(
	        	!openedDoc ? null : Document.getLabelElements(openedDoc, 'doc-label-menuoption')
	        )
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	n.routing.callLabelDefinitions(editor.getCurrentId());
	        }),

			// Create Reference
			options.noCreateReference ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Create Reference</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				var id = editor.getCurrentId();
				
				ReferenceActions.getInstance().createReference(id)
				.then(function(data) {
	        		if (data.message) {
	        			n.showAlert(data.message, "S", data.messageThreadId);
	        		}
					if (data.newIds && (data.newIds.length > 0)) {
						NoteTree.getInstance().focus(data.newIds[0]);
					}	        		
	        	})
				.catch(function(err) {
	        		n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
	        	});
			}),
	        
	        // References
			options.noRefs ? null : $('<div class="userbutton"><div class="fa fa-long-arrow-alt-right userbuttonIcon"></div>References</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				n.routing.call('refs/' + editor.getCurrentId());
			}),
	        
	        // History
	        options.noHistory ? null : $('<div class="userbutton"><div class="fa fa-history userbuttonIcon"></div>History</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	n.routing.call("history/" + editor.getCurrentId());
	        }),
	        
			// Download
			options.noDownload ? null : $('<div class="userbutton"><div class="fa fa-download userbuttonIcon"></div>Download</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				Document.downloadDocumentDialog(editor.getCurrentId())
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
				});
			}),
			
	        // Show in navigation
			options.noOpenInNavigation ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Show in Navigation</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				NoteTree.getInstance().focus(editor.getCurrentId());
				
				n.routing.call(editor.getCurrentId());
			}),
			
			$('<div class="userbuttonLine"></div>'),
			
			 // Raw JSON view
			options.noRawView ? null : $('<div class="userbutton"><div class="fa fa-code userbuttonIcon"></div>Raw JSON</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				n.routing.callRawView(editor.getCurrentId());
			}),
			
			!openedDoc ? null : $('<div class="userbuttonLine"></div>'),
			
			!openedDoc ? null : $('<div class="userbuttonPassive"></div>')
			.html('ID: ' + openedDoc._id)
			.on('click', function(event) {
				event.stopPropagation();
			}),
		];
	}
}