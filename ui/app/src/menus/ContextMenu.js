/**
 * Context options for items.
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
class ContextMenu { 
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Set up the options buttons popup into the DOM element with the passed ID.
	 */
	setupItemOptions(elementId) {
		$('#' + elementId).empty();
		
		var that = this;
		$('#' + elementId).append(
			$('<div class="treebuttons" id="treebuttons"/>').append([
				// Create document
				$('<div id="contextOptionCreate" data-toggle="tooltip" title="Create Document" class="contextOptionSingle fa fa-plus treebutton roundedButton contextOptionCreate"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
						if (that.#app.optionsIds.length != 1) return;
						
						that.#app.nav.block();
						that.#app.view.triggerCreateItem(that.#app.optionsIds[0])
						.then(function(data) {
							that.#app.nav.unblock();
							
							if (data.ok) {
								that.#app.view.message("Successfully created document.", "S");
							}
						})
						.catch(function(err) {
							that.#app.nav.unblock();
							that.#app.errorHandler.handle(err);
						});
					}),
					
				// Rename
				$('<div id="contextOptionRename" data-toggle="tooltip" title="Rename item" class="contextOptionSingle fa fa-pencil-alt treebutton roundedButton contextOptionRename"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
						if (that.#app.optionsIds.length != 1) return;
						
						that.#app.nav.block();
						that.#app.view.triggerRenameItem(that.#app.optionsIds[0])
						.then(function() {
							that.#app.nav.unblock();
						})
						.catch(function(err) {
							that.#app.nav.unblock();
							that.#app.errorHandler.handle(err);
						});
					}),
					
				// Show in navigation
				$('<div id="contextOptionShowInNavigation" data-toggle="tooltip" title="Show in Navigation" class="fa fa-map treebutton roundedButton contextOptionShowInNavigation"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	that.#app.hideOptions();
			        	if (that.#app.optionsIds.length != 1) return;
			        	const id = that.#app.optionsIds[0];
			        	
						that.#app.nav.highlightDocument(id, !that.#app.device.isLayoutMobile());	
			        }),

				// Relocate reference
				$('<div id="contextOptionReReference" data-toggle="tooltip" title="Set target" class="fa fa-bullseye treebutton roundedButton contextOptionReReference"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	that.#app.hideOptions();
			        	if (that.#app.optionsIds.length != 1) return;
			        	
			        	that.#app.actions.reference.setReference(that.#app.optionsIds[0])
			        	.then(function(data) {
							that.#app.view.message(data.message ? data.message : 'Successfully moved items', 'S');
						})
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
			        }),
					
				// Move
				$('<div id="contextOptionMove" data-toggle="tooltip" title="Move Note" class="fa fa-arrows-alt treebutton roundedButton contextOptionMove"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	that.#app.hideOptions();
			        	if (!that.#app.optionsIds.length) return;
			        	
			        	that.#app.view.triggerMoveItems(that.#app.optionsIds)
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
			        }),
			       
		    	// Copy
				$('<div id="contextOptionCopy" data-toggle="tooltip" title="Copy Note" class="contextOptionSingle fa fa-copy treebutton roundedButton contextOptionCopy"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
						if (that.#app.optionsIds.length != 1) return;
						
						that.#app.view.triggerCopyItem(that.#app.optionsIds[0])
						.then(function() {
							that.#app.view.message('Successfully copied item', 'S');
						})
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
							
				// Delete
				$('<div id="contextOptionDelete" data-toggle="tooltip" title="Delete item" class="fa fa-trash treebutton roundedButton contextOptionDelete"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
						if (!that.#app.optionsIds.length) return;
						
						that.#app.nav.block();
						
						that.#app.view.message("Preparing to delete items...", 'I');
						
						that.#app.view.triggerDeleteItem(that.#app.optionsIds)
						.then(function() {
							that.#app.nav.unblock();
						})
						.catch(function(err) {
							that.#app.nav.unblock();
							that.#app.errorHandler.handle(err);
						});
					}),
					
					
				// Text Color
		        $('<label id="contextOptionColor" data-toggle="tooltip" title="Set Text Color" class="fa fa-palette treebutton roundedButton contextOptionColor"></div>')
		    		.on('click', function(event) {
		    			event.stopPropagation();
		    		})
		            .append(
		            	$('<input type="color" class="colorinput" style="display: block; width: 1px; height: 1px; display: none;">')
				            .on('click', function(event) {
				            	event.stopPropagation();
				            	if (!that.#app.optionsIds.length) return;
				            	that.#app.prepareColorPicker(that.#app.optionsIds, this, false);
				            })
				            .on('change', function(event) {
				            	event.stopPropagation();
				            	if (!that.#app.optionsIds.length) return;
				            	that.#app.setColorPreview(that.#app.optionsIds, this, false)
				            })
				            .on('blur', function(event) {
				            	event.stopPropagation();
				            	if (!that.#app.optionsIds.length) return;
				            	that.#app.setColor(that.#app.optionsIds, this, false)
				            })
				            .on('input', function() {
				            	if (!that.#app.optionsIds.length) return;
				            	that.#app.setColorPreview(that.#app.optionsIds, this, false)
				            })
		            ),

				// BG Color
				$('<label id="contextOptionBgColor" data-toggle="tooltip" title="Set Background Color" class="fa fa-fill-drip treebutton roundedButton contextOptionBgColor"></div>')
					.on('click', function(event) {
						event.stopPropagation();
					})
			        .append(
			        	$('<input type="color" class="colorinput" style="display: block; width: 1px; height: 1px; display: none;">')
					        .on('click', function(event) {
					        	event.stopPropagation();
					        	if (!that.#app.optionsIds.length) return;
					        	that.#app.prepareColorPicker(that.#app.optionsIds, this, true);
					        })
					        .on('change', function(event) {
					        	event.stopPropagation();
					        	if (!that.#app.optionsIds.length) return;
					        	that.#app.setColorPreview(that.#app.optionsIds, this, true)
					        })
					        .on('blur', function(event) {
					        	event.stopPropagation();
					        	if (!that.#app.optionsIds.length) return;
					        	that.#app.setColor(that.#app.optionsIds, this, true)
					        })
					        .on('input', function() {
					        	if (!that.#app.optionsIds.length) return;
					        	that.#app.setColorPreview(that.#app.optionsIds, this, true)
					        })
			        ),

				// BG Image
				$('<label id="contextOptionBgImage" data-toggle="tooltip" title="Set background image..." class="fa fa-image treebutton roundedButton contextOptionBgImage"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
						if (!that.#app.optionsIds.length) return;
						
						that.#app.view.triggerSetItemBackgroundImage(that.#app.optionsIds)
						.catch(function(err) {
							that.#app.errorHandler.handle(err);
						});
					}),
					
				// Delete favorite entry
				$('<label id="contextOptionDeleteFavorite" data-toggle="tooltip" title="Remove from favorites bar" class="fa fa-times treebutton roundedButton contextOptionDeleteFavorite"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
					
						if (!that.#app.optionsIds.length) return;
						
						that.#app.removeFavorite(that.#app.optionsIds[0]);
					}),
					
				// Clear favorites history...
				$('<label id="contextOptionClearFavorites" data-toggle="tooltip" title="Clear favorites..." class="fa fa-trash-alt treebutton roundedButton contextOptionClearFavorites"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						that.#app.hideOptions();
					
						that.#app.clearFavorites();
					}),
					
				// Toggle star flag
				$('<label id="contextOptionToggleStar" data-toggle="tooltip" title="Add this document to the favorites" class="fa fa-star treebutton roundedButton contextOptionToggleStar"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						if (!that.#app.optionsIds.length) return;
						
						var doc = that.#app.data.getById(that.#app.optionsIds[0]);
						if (!doc) return;
						
						that.#app.actions.document.setStarFlag(doc._id, !doc.star)
						.then(function() {
							that.#app.updateOptionStyles();
						})
						.catch(function(err) {
							that.#app.updateOptionStyles();
							that.#app.errorHandler.handle(err);
						});					
					})
			])
		);
	}
	
}