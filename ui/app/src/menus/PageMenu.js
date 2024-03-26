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
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Generates the options for the different editors. Returns an array holding the options divs.
	 */
	get(page, options) {
		if (!options) options = {};
		
		if (this.#app.device.isLayoutMobile()) options.noOpenInNavigation = true;
		
		var editorMode = '';
		if (!(page instanceof Editor)) {
			options.noEditorModeSwitch = true;
		} else {
			editorMode = page.getEditorMode();
		}
		
		var openedDoc = this.#app.data.getById(page.getCurrentId());
		if (!openedDoc || (openedDoc.type != 'note') || ((openedDoc.editor != 'richtext') && (openedDoc.editor != 'code'))) options.noTags = true;
		
		var that = this;
		return [
			// Editor mode
			options.noEditorModeSwitch ? null : $('<div class="userbutton"></div>').append(
				Document.getEditorModeSelector(editorMode, {
					prefix: 'Editor: ',
					cssClass: 'userbuttonselect'
				})
				.on('change', function(event) {
					event.stopPropagation();
					that.#app.hideOptions();
					
					// Change board mode
					that.#app.actions.editor.saveEditorMode(page.getCurrentId(), this.value)
					.then(function(data) {
						that.#app.routing.call(page.getCurrentId());
					})
					.catch(function(err) {
						that.#app.errorHandler.handle(err);
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
				if (!openedDoc) return;
				
				function updateMenuItem(starred) {
					$('#pageMenuStarOptionIcon').css('color', starred ? '#c40cf7' : 'black');
					$('#pageMenuStarOptionText').text((starred ? 'Unpin from' : 'Pin to') + ' Favorites');
				}
				
				var newState = !openedDoc.star;
				that.#app.actions.document.setStarFlag(openedDoc._id, newState)
				.then(function(data) {
					updateMenuItem(newState);
				})
				.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});			
			}),
			
			// Share
			options.noShare ? null : $('<div class="userbutton"><div class="fa fa-share-square userbuttonIcon"></div>Share</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();
				
				try {
					navigator.share({
						title: page.getCurrentDoc() ? page.getCurrentDoc().name : page.getCurrentId(), 
						url: location.href
					});
  
  				} catch (err) {
  					that.#app.errorHandler.handle(err);
  				}
			}),
			
			// Create
			options.noCreate ? null : $('<div class="userbutton"><div class="fa fa-plus userbuttonIcon"></div>Create</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				that.#app.view.triggerCreateItem(page.getCurrentId())
				.then(function(data) {
					if (data.message) {
						that.#app.view.message(data.message, "S");
					}
				})
				.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});
			}),
			
			// Rename
			options.noRename ? null : $('<div class="userbutton"><div class="fa fa-pencil-alt userbuttonIcon"></div>Rename</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				that.#app.view.triggerRenameItem(page.getCurrentId())
				.then(function() {
					that.#app.routing.call(page.getCurrentId());
				})
				.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});
			}),
			
			// Move
			options.noMove ? null : $('<div class="userbutton"><div class="fa fa-arrows-alt userbuttonIcon"></div>Move</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();
	        	
	        	that.#app.actions.document.moveItems([page.getCurrentId()])
	        	.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});
	        }),
	        
	        // Copy
	        options.noCopy ? null : $('<div class="userbutton"><div class="fa fa-copy userbuttonIcon"></div>Copy</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();
	        	
	        	that.#app.view.triggerCopyItem(page.getCurrentId())
	        	.then(function() {
					that.#app.view.message('Successfully copied item', 'S');
				})
	        	.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});
	        }),
	        
	        // Delete
	        options.noDelete ? null : $('<div class="userbutton"><div class="fa fa-trash userbuttonIcon"></div>Delete</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();	
	        	
	        	var delId = page.getCurrentId();
	        	
	        	that.#app.view.triggerDeleteItem([delId])
				.then(function() {
	        		that.#app.routing.call();
	        	})
				.catch(function(err) {
	        		that.#app.errorHandler.handle(err);
	        		that.#app.routing.call(delId);
	        	});
	        }),
	        
	        $('<div class="userbuttonLine"></div>'),
	        
			// Tags
	        options.noTags ? null : $('<div class="userbutton"><div class="fa fa-hashtag userbuttonIcon"></div>Hashtags</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();
	        	
	        	that.#app.routing.callHashtags(page.getCurrentId());
	        }),

	        // Labels
	        options.noLabelDefinitions ? null : $('<div class="userbutton"><div class="fa fa-tags userbuttonIcon"></div>Labels</div>')
	        .append(
	        	!openedDoc ? null : Document.getLabelElements(openedDoc, 'doc-label-menuoption')
	        )
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();
	        	
	        	that.#app.routing.callLabelDefinitions(page.getCurrentId());
	        }),

			// Create Reference
			options.noCreateReference ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Create Reference</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				var id = page.getCurrentId();
				
				that.#app.actions.reference.createReference(id)
				.then(function(data) {
	        		if (data.message) {
	        			that.#app.view.message(data.message, "S");
	        		}
					if (data.newIds && (data.newIds.length > 0)) {
						that.#app.nav.focus(data.newIds[0]);
					}	        		
	        	})
				.catch(function(err) {
	        		that.#app.errorHandler.handle(err);
	        	});
			}),
	        
	        // References
			options.noRefs ? null : $('<div class="userbutton"><div class="fa fa-long-arrow-alt-right userbuttonIcon"></div>References</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				that.#app.routing.call('refs/' + page.getCurrentId());
			}),
	        
	        // History
	        options.noHistory ? null : $('<div class="userbutton"><div class="fa fa-history userbuttonIcon"></div>History</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	that.#app.hideOptions();
	        	
	        	that.#app.routing.call("history/" + page.getCurrentId());
	        }),
	        
			// Download
			options.noDownload ? null : $('<div class="userbutton"><div class="fa fa-download userbuttonIcon"></div>Download</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				Document.downloadDocumentDialog(page.getCurrentId())
				.catch(function(err) {
					that.#app.errorHandler.handle(err);
				});
			}),
			
	        // Show in navigation
			options.noOpenInNavigation ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Show in Navigation</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				that.#app.nav.highlightDocument(page.getCurrentId(), !that.#app.device.isLayoutMobile());
			}),
			
			$('<div class="userbuttonLine"></div>'),
			
			 // Raw JSON view
			options.noRawView ? null : $('<div class="userbutton"><div class="fa fa-code userbuttonIcon"></div>Raw JSON</div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#app.hideOptions();	
				
				that.#app.routing.callRawView(page.getCurrentId());
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