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
	
	/**
	 * Set up the options buttons popup into the DOM element with the passed ID.
	 */
	static setupItemOptions(elementId) {
		$('#' + elementId).empty();
		
		var n = Notes.getInstance();
		
		$('#' + elementId).append(
			$('<div class="treebuttons" id="treebuttons"/>').append([
				// Create note
				$('<div id="contextOptionCreate" data-toggle="tooltip" title="Create Document" class="contextOptionSingle fa fa-plus treebutton roundedButton contextOptionCreate"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (n.optionsIds.length != 1) return;
						
						NoteTree.getInstance().block();
						DocumentActions.getInstance().create(n.optionsIds[0])
						.then(function(data) {
							NoteTree.getInstance().unblock();
							
							if (data.ok) {
								n.showAlert("Successfully created document.", "S");
							}
						})
						.catch(function(err) {
							NoteTree.getInstance().unblock();
							n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
						});
					}),
					
				// Rename
				$('<div id="contextOptionRename" data-toggle="tooltip" title="Rename item" class="contextOptionSingle fa fa-pencil-alt treebutton roundedButton contextOptionRename"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (n.optionsIds.length != 1) return;
						
						NoteTree.getInstance().block();
						DocumentActions.getInstance().renameItem(n.optionsIds[0])
						.then(function(data) {
							NoteTree.getInstance().unblock();
							
							if (data.message) {
								n.showAlert(data.message, "S", data.messageThreadId);
							}
						})
						.catch(function(err) {
							NoteTree.getInstance().unblock();
							n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
						});
					}),
					
				// Show in navigation
				$('<div id="contextOptionShowInNavigation" data-toggle="tooltip" title="Show in Navigation" class="fa fa-map treebutton roundedButton contextOptionShowInNavigation"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	n.hideOptions();
			        	if (n.optionsIds.length != 1) return;
			        	const id = n.optionsIds[0];
			        	
						NoteTree.getInstance().highlightDocument(id, !Device.getInstance().isLayoutMobile());	
			        }),

				// Relocate reference
				$('<div id="contextOptionReReference" data-toggle="tooltip" title="Set target" class="fa fa-bullseye treebutton roundedButton contextOptionReReference"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	n.hideOptions();
			        	if (n.optionsIds.length != 1) return;
			        	
			        	ReferenceActions.getInstance().setReference(n.optionsIds[0])
			        	.then(function(data) {
							n.showAlert(data.message ? data.message : 'Successfully moved items', 'S', data.messageThreadId);
						})
						.catch(function(err) {
							n.showAlert(err.message ? err.message : 'Error moving items.', err.abort ? 'I' : 'E', err.messageThreadId);
						});
			        }),
					
				// Move
				$('<div id="contextOptionMove" data-toggle="tooltip" title="Move Note" class="fa fa-arrows-alt treebutton roundedButton contextOptionMove"></div>')
			        .on('click', function(event) {
			        	event.stopPropagation();
			        	n.hideOptions();
			        	if (!n.optionsIds.length) return;
			        	
			        	DocumentActions.getInstance().moveItems(n.optionsIds)
			        	.then(function(data) {
							n.showAlert(data.message ? data.message : 'Successfully moved items', 'S', data.messageThreadId);
						})
						.catch(function(err) {
							n.showAlert(err.message ? err.message : 'Error moving items.', err.abort ? 'I' : 'E', err.messageThreadId);
						});
			        }),
			       
		    	// Copy
				$('<div id="contextOptionCopy" data-toggle="tooltip" title="Copy Note" class="contextOptionSingle fa fa-copy treebutton roundedButton contextOptionCopy"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (n.optionsIds.length != 1) return;
						
						DocumentActions.getInstance().copyItem(n.optionsIds[0])
						.then(function(/*data*/) {
							n.showAlert('Successfully copied item', 'S');
						})
						.catch(function(err) {
							n.showAlert(err.message ? err.message : 'Error copying item.', err.abort ? 'I' : 'E', err.messageThreadId);
						});
					}),
							
				// Delete
				$('<div id="contextOptionDelete" data-toggle="tooltip" title="Delete item" class="fa fa-trash treebutton roundedButton contextOptionDelete"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (!n.optionsIds.length) return;
						
						NoteTree.getInstance().block();
						
						n.showAlert("Preparing to delete items...", 'I', 'DeleteMessages');
						
						DocumentActions.getInstance().deleteItems(n.optionsIds).then(function(data) {
							NoteTree.getInstance().unblock();
							
							if (data.message) {
								n.showAlert(data.message, "S", data.messageThreadId);
							}
							
						}).catch(function(err) {
							NoteTree.getInstance().unblock();
							
							n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
						});
					}),
					
				// Labels
				$('<div id="contextOptionLabels" data-toggle="tooltip" title="Labels..." class="contextOptionSingle fa fa-tags treebutton roundedButton contextOptionLabels"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (n.optionsIds.length != 1) return;

						var doc = Notes.getInstance().getData().getById(n.optionsIds[0]);
						if (!doc) return;
						
						n.routing.callLabelDefinitions(n.optionsIds[0]);
					}),
					
				// History
				/*$('<div id="contextOptionHistory" data-toggle="tooltip" title="Note History..." class="contextOptionSingle fa fa-history treebutton roundedButton contextOptionHistory"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (n.optionsIds.length != 1) return;

						var doc = Notes.getInstance().getData().getById(n.optionsIds[0]);
						if (!doc) return;
						
						if (!Document.hasTypeHistory(doc.type)) {
							n.showAlert('No history available for this type of item.', 'I');
							return;
						}
						
						n.routing.call("history/" + n.optionsIds[0]);
					}),*/
					
				// Text Color
		        $('<label id="contextOptionColor" data-toggle="tooltip" title="Set Text Color" class="fa fa-palette treebutton roundedButton contextOptionColor"></div>')
		    		.on('click', function(event) {
		    			event.stopPropagation();
		    		})
		            .append(
		            	$('<input type="color" class="colorinput" style="display: block; width: 1px; height: 1px; display: none;">')
				            .on('click', function(event) {
				            	event.stopPropagation();
				            	if (!n.optionsIds.length) return;
				            	n.prepareColorPicker(n.optionsIds, this, false);
				            })
				            .on('change', function(event) {
				            	event.stopPropagation();
				            	if (!n.optionsIds.length) return;
				            	n.setColorPreview(n.optionsIds, this, false)
				            })
				            .on('blur', function(event) {
				            	event.stopPropagation();
				            	if (!n.optionsIds.length) return;
				            	n.setColor(n.optionsIds, this, false)
				            })
				            .on('input', function(event) {
				            	if (!n.optionsIds.length) return;
				            	n.setColorPreview(n.optionsIds, this, false)
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
					        	if (!n.optionsIds.length) return;
					        	n.prepareColorPicker(n.optionsIds, this, true);
					        })
					        .on('change', function(event) {
					        	event.stopPropagation();
					        	if (!n.optionsIds.length) return;
					        	n.setColorPreview(n.optionsIds, this, true)
					        })
					        .on('blur', function(event) {
					        	event.stopPropagation();
					        	if (!n.optionsIds.length) return;
					        	n.setColor(n.optionsIds, this, true)
					        })
					        .on('input', function(event) {
					        	if (!n.optionsIds.length) return;
					        	n.setColorPreview(n.optionsIds, this, true)
					        })
			        ),

				// BG Image
				$('<label id="contextOptionBgImage" data-toggle="tooltip" title="Set background image..." class="fa fa-image treebutton roundedButton contextOptionBgImage"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
						if (!n.optionsIds.length) return;
						
						DocumentActions.getInstance().setItemBackgroundImage(n.optionsIds)
						.then(function(data) {
							if (data.message) n.showAlert(data.message, 'S', data.messageThreadId);
						})
						.catch(function(err) {
							n.showAlert(err.message ? err.message : 'Error setting background image for item.', err.abort ? 'I' : 'E', err.messageThreadId);
						});
					}),
					
				// Delete favorite entry
				$('<label id="contextOptionDeleteFavorite" data-toggle="tooltip" title="Remove from favorites bar" class="fa fa-times treebutton roundedButton contextOptionDeleteFavorite"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
					
						if (!n.optionsIds.length) return;
						
						n.removeFavorite(n.optionsIds[0]);
					}),
					
				// Clear favorites history...
				$('<label id="contextOptionClearFavorites" data-toggle="tooltip" title="Clear favorites..." class="fa fa-trash-alt treebutton roundedButton contextOptionClearFavorites"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						n.hideOptions();
					
						n.clearFavorites();
					}),
					
				// Toggle star flag
				$('<label id="contextOptionToggleStar" data-toggle="tooltip" title="Add this document to the favorites" class="fa fa-star treebutton roundedButton contextOptionToggleStar"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						if (!n.optionsIds.length) return;
						
						var doc = n.getData().getById(n.optionsIds[0]);
						if (!doc) return;
						
						DocumentActions.getInstance().setStarFlag(doc._id, !doc.star)
						.then(function(data) {
							n.updateOptionStyles();
						})
						.catch(function(err) {
							n.updateOptionStyles();
							n.showAlert(err.message ? err.message : 'Error setting star flag for item.', err.abort ? 'I' : 'E', err.messageThreadId);
						});					
					})
			])
		);
	}
	
}