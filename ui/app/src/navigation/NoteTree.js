/**
 * Tree Handler
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
class NoteTree {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!NoteTree.instance) NoteTree.instance = new NoteTree();
		return NoteTree.instance;
	}
	
	constructor() {
		this.treeNavContainerId = "treenav";
		this.treeContainerId = "treeContainer";
		this.treeGridElementId = "treeview";
		
		this.treeRootModeSwitchContainer = "treeRootModeSwitchContainer";
		this.treeRootTopSwitchContainer = "treeRootTopSwitchContainer";
	}
	
	/**
	 * Initialize the tree view with the given data.
	 */
	init(noAnimation) {
		var that = this;
		
		// Get behaviour instance depending on the view mode
		this.initBehaviour();
		
		// Keep the collapsed/expanded state of the old tree. The grid is down at the moment, so this
		// will just build up the expanded array, and the filter function will be called later.
		// Reason why this is called here: The tree width in desktop mode has to be set as early as possible.
		ClientState.getInstance().restoreTreeState();

		if (!this.grid) {
			// Clear DOM elements
			$('#' + this.treeGridElementId).empty();
		
			// Reset additional content
			$('#' + this.treeRootTopSwitchContainer).empty();
			
			// Callback to the behaviour implementation before we start building the grid
			this.behaviour.beforeInit();
			
			// Create Muuri instance
			this.grid = new MuuriGrid('#' + this.treeGridElementId, {
				dragHandle: '.' + this.behaviour.getDragHandleClass(),
				contentClass: this.behaviour.getItemContentClass(),
				moveIntoClass: this.behaviour.getMoveIntoClass(),
				dragDelayMillis: 0,  // Not used: We use our own delayed click handler: see TouchClickHandler.js
				scoreMatchingThreshold: this.behaviour.getScoreMatchingThreshold(),
				
				autoScrollTargets: {
					targets: (item) => {
						return [
							{ 
								element: $('#' + that.treeContainerId)[0],
								priority: 1,
								axis: Muuri.AutoScroller.AXIS_Y
							},
						];
					}
				},
				
				dragInitCallback: function(item, event) {
					// Block the next deselect event (this disturbs moving items)
					that.blockDeselectCallback = true;
				},
				
				dropIntoCallback: function(srcItem, targetItem) {
					var src = that.getGridItemContent(srcItem);
					var tar = that.getGridItemContent(targetItem);
					
					that.doDrop(src, tar, true);
				},
				
				dropBeneathCallback: function(srcItem, targetItem) {
					var src = that.getGridItemContent(srcItem);
					var tar = that.getGridItemContent(targetItem);
					
					that.doDrop(src, tar, false);
				},
				
				enableDropCallback: function(srcItem, targetItem, dropInto) {
					var src = that.getGridItemContent(srcItem);
					var tar = that.getGridItemContent(targetItem);
					
					// Hide options here (doing this on drag init will cause other bad consequences in terms of falsely opening the document)
					Notes.getInstance().hideOptions();
					
					return that.behaviour.isDropAllowed(src, tar, dropInto); 
				},
				
				onFinishCallback: function(items) {
					that.behaviour.onLayoutFinish(items);
				},
				
				layoutCallback: this.behaviour.getLayoutCallback(),
				sortData: this.behaviour.getSortFunctions(),
				
			});
				
			// Register right click event to create new item on grid
			$('#' + this.treeContainerId).contextmenu(function(e) {
        		e.preventDefault();
        		e.stopPropagation();
        		
        		Notes.getInstance().hideOptions();
        		
        		that.block();
				Actions.getInstance().create(that.behaviour.getNewItemParent())
				.then(function(data) {
					that.unblock();
					if (data.message) {
						Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
					}
				})
				.catch(function(err) {
					that.unblock();
					Notes.getInstance().showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
				});
        	});
			
			// Back to root on grid double click
			$('#' + this.treeContainerId).off('dblclick');
			$('#' + this.treeContainerId).on('dblclick', function(event) {
				event.stopPropagation();
				
				Notes.getInstance().hideOptions();
				
				that.behaviour.onNavigationDoubleClick(event);
			});
			
			// Deselect handler (triggered when the user clicks on the empty root options bar)
			$('#' + this.treeNavContainerId).off('click');
			$('#' + this.treeNavContainerId).on('click', function(e) {
				e.stopPropagation();
				
				if (that.blockDeselectCallback) {
					// This is used so that after certain events, the deselect handler is not executed to not get in the way.
					// Espacially after moving items.
					that.blockDeselectCallback = false;
					return;
				}
				Notes.getInstance().hideOptions();
				NoteTree.getInstance().resetSelectedState();
			});
			
			// Reset selection
			this.setSelected();
			
			// Callback to the behaviour implementation after initialization
			this.behaviour.afterInit();

			this.filter(true);
		} else {
			this.filter(noAnimation);
		}
		
		Settings.getInstance().apply();
		
		this.updateFavorites();
		
		// Callbacks for color picking
		Notes.getInstance().registerOptionsCallbacks({
			id: 'tree',
			
			onColorInputPrepare: function(doc, back, input) {
				that.setSelected();
				that.behaviour.beforeColorPicker(doc._id, input, back);
			},
			
			onColorInputUpdate: function(doc, back, input) {
				that.refreshColors(doc._id);
			}
		});
		
		Notes.getInstance().update();
		
		this.unblock();
	};	
	
	/**
	 * Updates the favorites bar
	 */
	updateFavorites() {
		var c = ClientState.getInstance();
		
		var favBar = $('#favBar');
		if (!favBar) return;
		
		// Clear content and hide at first
		favBar.empty();
		favBar.css('height', 'auto');
		this.showFavorites(false);
		
		// No favorites: Dont show anything
		var favorites = c.getFavorites();
		if (!favorites) return;

		// Should the currently opened document be shown?
		var currentId = Notes.getInstance().getCurrentlyShownId(true);
		var showCurrentInFavorites = !c.getViewSettings().showCurrentInFavorites;
		if (!showCurrentInFavorites) currentId = false;

		// Get favorites as array and sort it
		var favsSorted = [];
		for (var prop in favorites) {
		    if (favorites.hasOwnProperty(prop)) {
		        var fav = favorites[prop];
				if (!fav) continue;
				if (currentId && (currentId == fav.id)) continue;
				if (!Notes.getInstance().getData()) continue;

				var doc = Notes.getInstance().getData().getById(fav.id);
				if (!doc) continue;
				
				if (doc.deleted) continue;
				
				favsSorted.push(fav);
		    }
		}
		
		favsSorted.sort(function(b, a){return (a.rank ? a.rank : 0) - (b.rank ? b.rank : 0); });
		if (favsSorted.length == 0) return;

		// We have favorites: Check if the user wants to see them
		var showFavorites = !c.getViewSettings().dontShowFavorites;
		if (!showFavorites) return;
		
		var favSize = c.getViewSettings().favoritesSize;
		if (!favSize) favSize = 70;
		favBar.css('height', (favSize + 7) + 'px');
		
		var favoritesNum = c.getViewSettings().favoritesNum;
		if (!favoritesNum) favoritesNum = 10;
				
		// Add the favorites to the bar
		for(var i=0; i<favsSorted.length && i<favoritesNum; ++i) {
			this.addFavoriteToBar(favsSorted[i]);
		}
		
		// Show favorites		
		this.showFavorites(true);
	}
	
	/**
	 * Gets the text to show (including <br> breaks)
	 */
	getFavoriteText(doc) {
		if (!doc || !doc.name) return "[MISSING TEXT]";
		
		var nameSplit = doc.name.split(" ");
		if (nameSplit.length == 0) return "[MISSING TEXT]";
		
		var favSize = ClientState.getInstance().getViewSettings().favoritesSize;
		if (!favSize) favSize = 70;
		
		var ret = "";
		var i = 0;
		var maxLen = favSize / (this.getTreeTextSize() * 0.7);
		var maxLines = favSize / (this.getTreeTextSize() * 2);
		var lines = 0;
		
		while (i < nameSplit.length) {
			var line = "";
			while (i < nameSplit.length) {
				line += nameSplit[i++] + " ";
				if (line.length > maxLen) break;			
			}
			if (line.length > 0) {
				if (lines < maxLines) {
					ret += line + "<br>";
					lines++;
				} else {
					ret += line + " ";
				}
			}
		}
		
		var data = Notes.getInstance().getData();
		
		while (doc.parent && (lines < maxLines)) {
			var doc = data.getById(doc.parent);
			ret = doc.name + " /<br>" + ret;
			lines++;
		}
		
		return ret;
	}
	
	/**
	 * Add one favorite to the bar (internal usage only).
	 */
	addFavoriteToBar(favEntry) {
		var favBar = $('#favBar');
		
		var data = Notes.getInstance().getData();
		if (!data) return;
		
		var doc = data.getById(favEntry.id);
		if (!doc) return;
		
		var favSize = ClientState.getInstance().getViewSettings().favoritesSize;
		if (!favSize) favSize = 70;
		
		var nameHtml = this.getFavoriteText(doc);
		
		var that = this;
		var el = $('<div class="favoriteItem"></div>')
			.css('width', favSize + 'px')
			.css('height', favSize + 'px')
			.css('margin', '2px')
			.data('id', favEntry.id)
			.append(
				$('<div class="favoriteItemText"></div>')
				.css('font-size', (this.getTreeTextSize() * 0.7) + 'px')
				.html(nameHtml),
				
				$('<div class="selectedFavorite"></div>')
			)
			
		function handleFavContext(event) {
			event.stopPropagation();
			event.preventDefault();
			
			var data = $(event.currentTarget).data();
			
			Notes.getInstance().callOptions([data.id], Tools.extractX(event), Tools.extractY(event), {
				showInNavigation: false,      // Show in Navigation (default: hidden)
				noMove: true,                // Hide move option
				noCopy: true,                // Hide copy option
				noDelete: true,              // Hide delete option
				noLabels: true,
				noBgColor: true,
				noColor: true,
				noCreate: true,
				noBgImage: true,
				showDeleteFavorite: true,
				showClearFavorites: true
			});
			
			$(event.currentTarget).find('.selectedFavorite').css('display', 'inherit');
		}
			
		el.contextmenu(handleFavContext);
		el.mainEvent = new TouchClickHandler(el, {
			onGestureFinishCallback: function(event) {
				event.stopPropagation();

				var data = $(event.currentTarget).data();

				that.openNode(data.id);
				that.focus(data.id);
				
			},
			
			delayedHoldCallback: handleFavContext,
			delayHoldMillis: 600
		});
			
		Document.setBackground(doc, el);
		if (doc.color) el.css('color', doc.color);
		
		favBar.append(
			el
		);
	}
	
	/**
	 * Removes selection mark from favorites.
	 */
	deselectFavorites() {
		$('.selectedFavorite').css('display', 'none');
	}

	/**
	 * Updates the grid item DOM to match the currently visible 
	 * items before filter() is actually called on the grid.
	 */
	updateDomItems(add) {
		var data = Notes.getInstance().getData();
		if (!data) return;
		
		var currentItems = this.grid.grid.getItems();
		var searchText = this.getSearchText();

		if (searchText.length > 0) {
			this.showFavorites(false);
		} else {
			this.updateFavorites();
		}

		var that = this;
		function getItemById(id) {
			for(var i in currentItems) {
				var el = that.getGridItemContent(currentItems[i]);
				var dt = el.data();
				if (dt.id == id) return currentItems[i];
			}
			return null;
		}
		
		var maxSearchResults = Settings.getInstance().settings.maxSearchResults;
		if (!maxSearchResults) maxSearchResults = 20;
		
		var cnt = 0;
		data.each(function(doc) {
			var visible = that.behaviour.isItemVisible(doc, searchText);
			var item = getItemById(doc._id);
			
			if (visible) {
				cnt++;
				if (!item && add && (!searchText || (cnt <= maxSearchResults))) {
					// Does not exist: Create and add it
					item = that.createItem(doc)[0];
					
					that.grid.grid.add([item], {
						index: doc.order,
						layout: false
					});
				}
			} else {
				if (item && !add) {
					// Remove
					that.grid.grid.remove([item], {
						removeElements: true,
						layout: false
					});
				}
			}
		});
	}

	/**
	 * Create a grid item from the passed document 
	 */
	createItem(doc) {
		var data = Notes.getInstance().getData();
		if (!data) return;
		
		var li = $('<div class="' + this.behaviour.getItemContentClass() + '" />');
		var licont = $('<div class="' + this.behaviour.getItemClass() + '" id="node_' + doc._id + '" />').append(li);
		
		// Set the document ID as data attribute for reference
		li.attr('data-id', doc._id);

		// Colors (inherited when no color is set)
		/*if (doc.backColor) {
			licont.css('background-color', doc.backColor);
		}
		
		if (doc.color) {
			licont.css('color', doc.color);
		}*/
		
		// Is it a folder?
		var isFolder = data.hasChildren(doc._id);
		if (isFolder) {
			li.addClass('folder');
		}
		
		// Icon
		var iconclass = this.behaviour.getIconStyleClass(isFolder, false, doc); //isFolder ? this.behaviour.getIconFolderClass(false) : this.behaviour.getIconDoctypeClass(doc.type);

		// Conflict icon
		var conflictIcon = "";
		if (data.hasConflicts(doc._id, true)) {
			conflictIcon = '<span class="fa fa-exclamation conflictIcon"></span>';
		}
		
		// Build inner DOM of node
		this.behaviour.setupItemContent(li, doc.level, doc, iconclass, conflictIcon, false, isFolder);
		
		// Attach item events
		this.behaviour.registerItemEvents(li);
		
		// Right click to open options menu
		var that = this;
		li.contextmenu(function(e) {
    		e.preventDefault();
    		e.stopPropagation();
    		
    		var data = $(e.currentTarget).data();
    		
			that.behaviour.callOptionsWithId([data.id], Tools.extractX(e), Tools.extractY(e));
    	});
		
		// Color the item correctly
		this.refreshColors(doc._id, li);
		
		// Drop files into the container of the tree
		Tools.dropFilesInto([
			{
				elements: li,
				callback: function(files, definition, element) {
					console.log("Dropped " + files.length + " files into " + doc.name);
					
					Actions.getInstance().uploadAttachments(doc._id, files)
					.catch(function(err) {
						Notes.getInstance().showAlert(err.message ? err.message : 'Error uploading files', err.abort ? 'I' : 'E', err.messageThreadId);
					});
				}
			}
		]);
		
		// Return element
		return licont;
	}
	
	/**
	 * Set up the DOM tree for the tree.
	 */
	setupDom() {
		var that = this;
		
		$('#' + this.treeNavContainerId).append(
			$('<div id="' + this.treeContainerId + '"></div>').append(
				$('<div id="searchBarTree" class="searchBar searchBarTree"></div>').append(
					$('<input type="text" id="treeSearch" placeholder="Type text to search..." />')
					.on('focus', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						if (that.behaviour) that.behaviour.saveScrollPosition();
					})
					.on('input', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						that.updateSearch();
					})
					.on('keydown', function(event) {
						if(event.which == 27){
							event.stopPropagation();
							Notes.getInstance().hideOptions();
							that.setSearchText('');
					    }
					}),
					
					$('<div id="searchCancelButton" class="searchCancelButton fa fa-times"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						that.setSearchText('');
					})
				),
				
				$('<div id="favBar" class="favBar favBarTree"></div>'),

				$('<div id="treeGridContainer" />').append(
					// Grid 
					$('<div id="' + this.treeGridElementId + '" class="treeview" />'),
					
					// Top stuff (sort etc)
					$('<div id="' + this.treeRootTopSwitchContainer + '" />')
				),
				$('<br>'),
				$('<br>'),
				$('<br>'),
			),

			$('<div id="' + this.treeRootModeSwitchContainer + '" />').append(
				// Back Button
				$('<div data-toggle="tooltip" title="Back" class="fa fa-level-up-alt treeModeSwitchbutton roundedButton" id="treeBackButton"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						that.behaviour.backButtonPushed(event);
					}),
					
				// Home Button
				$('<div data-toggle="tooltip" title="Home" class="fa fa-home treeModeSwitchbutton roundedButton" id="treeHomeButton"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						that.behaviour.homeButtonPushed(event);
					}),
				
				// Create note
				$('<div data-toggle="tooltip" title="Create Document" class="fa fa-plus treeModeSwitchbutton roundedButton"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						that.block();
						Actions.getInstance().create(that.behaviour.getNewItemParent())
						.then(function(data) {
							that.unblock();
							if (data.message) {
								Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
							}
						})
						.catch(function(err) {
							that.unblock();
							Notes.getInstance().showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
						});
					}),
						
				// Toggle navigation mode
				$('<div data-toggle="tooltip" title="Toggle navigation mode" class="fa fa-' + Behaviours.getNavModeIcon(Behaviours.getNextNavMode()) + ' treeModeSwitchbutton roundedButton"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						Notes.getInstance().hideOptions();
						var s = ClientState.getInstance().getViewSettings();
						s.navMode = Behaviours.getNextNavMode();
						ClientState.getInstance().saveViewSettings(s);

						Behaviours.setNavModeIconClass($(this), Behaviours.getNextNavMode());
						
						that.refresh();
					})
			),
			
			$('<div id="treeblock"></div>')
		);

		// Drop files into the container of the tree
		Tools.dropFilesInto([
			{
				elements: $('#' + this.treeNavContainerId),
				callback: function(files, definition, element) {
					console.log("Dropped " + files.length + " files into navigation container");
					
					Actions.getInstance().uploadAttachments(that.behaviour.getNewItemParent(), files)
					.catch(function(err) {
						Notes.getInstance().showAlert(err.message ? err.message : 'Error uploading files', err.abort ? 'I' : 'E', err.messageThreadId);
					});
				}
			}
		]);
		
		// Action callbacks
		Actions.getInstance().registerCallback(
			'tree',
			'requestTree',
			function(data) {
				that.destroy();
				that.init();
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'loadDocument',
			function(docs) {
				that.updateSelectedState(true);
				for(var d in docs) {
					var persDoc = Notes.getInstance().getData() ? Notes.getInstance().getData().getById(docs[d]._id) : null;
					if (persDoc) {
						that.behaviour.afterRequest(persDoc._id);
					}
				}
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'openDocument',
			function(doc) {
				var n = Notes.getInstance();
				n.triggerUnSyncedCheck();
				n.addFavorite(doc);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'create',
			function(newIds) {
				that.destroy();
				that.init();
				
				// NOTE: Without the timeout, the parent is not displayed right.
				setTimeout(function() {
					that.focus(newIds[0]);
				}, 0);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'save',
			function(doc) {
				that.behaviour.afterSave(doc);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'moveDocumentBeforeSave',
			function(data) {
				// Block further actions until the move has been finished and the new tree has been reloaded
				that.behaviour.afterDropBeforeSave(data.docsSrc, data.docTarget, data.moveToSubOfTarget);

			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'moveDocumentAfterSave',
			function(data) {
				return that.behaviour.afterDrop(data.docsSrc, data.docTarget, data.moveToSubOfTarget);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'requestConflict',
			function(data) {
				that.updateSelectedState(true);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'delete',
			function(docs) {
				that.destroy();
				that.init();
				
				that.behaviour.afterDelete(docs);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'rename',
			function(data) {
				that.destroy();
				that.init();
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'copy',
			function(data) {
				that.destroy();
				that.init();
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'saveLabels',
			function(data) {
				that.destroy();
				that.init(true);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'saveLabelDefinitions',
			function(data) {
				that.destroy();
				that.init(true);
			}
		);
		Actions.getInstance().registerCallback(
			'tree',
			'importFinished',
			function(data) {
				that.destroy();
				that.init(true);
			}
		);
	}
	
	/**
	 * Set favorites visibility
	 */
	showFavorites(show) {
		if (show) {
			$('#favBar').show();
		} else {
			$('#favBar').hide();
		}
	}
	
	/**
	 * Reset scroll position memory for the given parent ID.
	 */
	resetScrollPosition(parent) {
		if (this.behaviour) this.behaviour.resetScrollPosition(parent);
	}
	
	/**
	 * Sets focus on the given document.
	 */
	focus(id) {
		this.behaviour.focus(id);
		this.setSelected(id);
	}
	
	/**
	 * Opens the given document in the navigation.
	 */
	open(id) {
		this.behaviour.open(id);
		this.setSelected(id);
	}
	
	/**
	 * Get behaviour instance depending on the view mode. Called on init().
	 */
	initBehaviour() {
		var cs = ClientState.getInstance().getViewSettings();
		if (!this.behaviour || (cs.navMode != this.navMode)) {
			this.behaviour = Behaviours.get(cs.navMode, this);
			this.destroy();
		} else {
			this.behaviour.reset();
		}
		this.navMode = cs.navMode;
	}
	
	/**
	 * Destroy grid.
	 */
	destroy() {
		if (this.grid) {
			this.grid.destroy();
			this.grid = null;
		}
	}
	
	/**
	 * Show or hide the root options
	 */
	showRootOptions(show) {
		$('#' + this.treeRootModeSwitchContainer).css('display', show ? 'block' : 'none');
	}
	
	/**
	 * Show the block div until the next init
	 */
	block() {
		$('#treeblock').css('display', 'block');
	}
	
	/**
	 * Show the block div until the next init
	 */
	unblock() {
		$('#treeblock').css('display', 'none');
	}
	
	/**
	 * Refresh tree
	 */
	refresh() {
		if (!this.grid) return;
		ClientState.getInstance().saveTreeState();
		this.init(true);
	}
	
	/**
	 * Returns the tree item content element for a given document.
	 */
	getItemContent(id) {
		var nodeElement = $('#node_' + id).find('.' + this.behaviour.getItemContentClass());
		if (!nodeElement.length) return null;
		return nodeElement;
	}
	
	/**
	 * Returns the inner content of a muuri item instance.
	 */
	getGridItemContent(item) {
		return $(item.getElement()).find('.' + this.behaviour.getItemContentClass());
	}
	
	/**
	 * Opens a document by its id. Called by event handlers etc.
	 */
	openNode(id) {
		var n = Notes.getInstance();
		
		this.behaviour.focus(id);
		
		// Open the note/document
		n.routing.call(id);			
	}
	
	/**
	 * Set the currently selected item by ID.
	 */
	setSelected(id) {
		if (this.selected == id) {
			ClientState.getInstance().saveTreeState();
			return;
		}
		
		var old = this.getItemContent(this.selected)
		if (old) {
			this.behaviour.deselectItem(old);
		}

		this.selected = id;
		
		ClientState.getInstance().saveTreeState();
		
		if (this.selected) {
			var doc = this.getItemContent(this.selected)
			if (!doc) return;
			
			this.behaviour.selectItem(doc);
		}
		
		this.filter();
	}
	
	/**
	 * Takes care that the selected item is always the opened note.
	 */
	updateSelectedState(selectOpened) {
		if (!this.grid) return;
		
		// If nothing is selected, select the opened note if any.
		if (selectOpened && !this.selected) {
			var e = Notes.getInstance().getCurrentEditor();
			if (!e) return;
			
			var opened = e.getCurrentId();

			if (opened) {
				this.setSelected(opened);
			}
		}
	}

	/**
	 * Called when opening an editor in mobile mode, to have influence on the buttons at the bottom left.
	 * In desktop mode no buttons are there so this does not have any influence.
	 */
	initEditorNavButtons() {
		if (this.behaviour) {
			this.behaviour.initEditorNavButtons();
		}
	}
	
	/**
	 * Returns the tree text size
	 */
	getTreeTextSize() {
		return parseFloat($('#' + this.treeNavContainerId).css('font-size'));
	}
	
	/**
	 * Sets the tree text size
	 */
	setTreeTextSize(size) {
		if (!size) size = this.getTreeTextSize();
		size = parseFloat(size);
		
		$('#' + this.treeGridElementId).css('font-size', size + "px");
		$('#' + this.treeNavContainerId).css('font-size', size + "px");
		
		$('.treeicon').css('min-width', (size * (40/18)) + "px");
	}
	
	/**
	 * Returns the width of the nav panel. Only relevant in non-mobile mode.
	 */
	getContainerWidth() {
		return $('#' + this.treeNavContainerId).outerWidth();
	}
	
	/**
	 * Set the width of the tree container.
	 */
	setContainerWidth(w) {
		$('#' + this.treeNavContainerId).css('width', w + 'px'); 
	}
	
	/**
	 * Sets a search text.
	 */
	setSearchText(txt) {
		$('#treeSearch').val(txt);
		return this.updateSearch();
	}
	
	/**
	 * Update search (delayed). 
	 */
	updateSearch() {
		var text = this.getSearchText();
		
		var that = this;
		if (text && (text.length > 0)) {
			// Load all documents
			return Actions.getInstance().loadAllDocuments()
			.then(function(resp) {
				that.filter(true);
				
				return Promise.resolve({ ok: true });
			});
		} else {
			// Just filter
			return new Promise(function(resolve, reject) {
				that.filter(true);
				
				resolve({ ok: true });
			});
		}
	}
	
	/**
	 * Returns the current search text.
	 */
	getSearchText() {
		return $('#treeSearch').val();
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Applies the current filter to the grid. 
	 */
	filter(noAnimations) {
		if (!this.grid) return true;

		this.behaviour.beforeFilter(noAnimations);
		
		var searchText = this.getSearchText();

		this.updateDomItems(true);
		
		var that = this;
		this.grid.grid.filter(function (item) {
			var n = Notes.getInstance();
			
			var el = that.getGridItemContent(item);
			var dt = el.data();
			
			var id = dt.id;
			
			var doc = n.getData().getById(id);
			var visible = that.behaviour.isItemVisible(doc, searchText); 
			
			// Set the folder open/close icons
			if (visible && n.getData().hasChildren(id)) {
				var opened = that.behaviour.isItemOpened(doc); 
				var ic = $(el).find('.' + that.behaviour.getIconClass());
				
				var folderClosedClass = that.behaviour.getIconStyleClass(true, false, doc);
				var folderOpenedClass = that.behaviour.getIconStyleClass(true, true, doc);
				
				if (opened) {
					ic.toggleClass(folderClosedClass, !opened);
					ic.toggleClass(folderOpenedClass, opened);					
				} else {
					ic.toggleClass(folderOpenedClass, opened);					
					ic.toggleClass(folderClosedClass, !opened);
				}
			}

			// Disable dragging for conflicts
			that.behaviour.setItemStyles(item, doc, $(el).parent(), $(el), visible, searchText);
			
			return visible;
			
		}, noAnimations ? {
			instant: true,
			layout: "instant",
			onFinish: function() {
				that.updateDomItems(false);
				that.grid.grid.refreshItems();
				that.grid.refresh();
				that.behaviour.afterFilter(noAnimations);
				//that.behaviour.restoreScrollPosition();
			}
		} : {
			onFinish: function() {
				that.updateDomItems(false);
				that.grid.grid.refreshItems();
				that.grid.refresh();
				that.behaviour.afterFilter(noAnimations);
				//that.behaviour.restoreScrollPosition();
			}
		});
	}
	
	/**
	 * Drop action.
	 */
	doDrop(src, tar, moveToSubOfTarget) {
		var srcId = src.data().id;
    	var tarId = tar.data().id;

    	var srcName = Notes.getInstance().getData().getById(srcId).name;
    	var tarName = Notes.getInstance().getData().getById(tarId).name;
    	
    	var doAsk = Settings.getInstance().settings.askBeforeMoving;
    	if (doAsk && !confirm("Move " + srcName + " to " + tarName + "?")) {
			Notes.getInstance().showAlert("Moving cancelled.", "I");
			return;
		}
    	
    	var that = this;
    	Actions.getInstance().moveDocuments([srcId], tarId, moveToSubOfTarget)
    	.catch(function(err) {
    		Notes.getInstance().showAlert("Error moving document: " + err.message, err.abort ? 'I' : 'E', err.messageThreadId);
    	});
	}
	
	/**
	 * Updates the orders of all visible child items of id in the data model accordingly.
	 * Returns a list of IDs which have been touched.
	 */
	reorderVisibleChildItems(id) {
		var n = Notes.getInstance();
		
		var no = 1;
    	var all = this.grid.grid.getItems();

    	var ret = [];
    	//for(var i=0; i<all.length; ++i) {
    	for(var i in all) {
			var iid = $(this.getGridItemContent(all[i])).data().id;
			var childDoc = n.getData().getById(iid);
			if (childDoc.parent != id) continue;
			
			var newOrder = no++;
			if (childDoc.order != newOrder) {
				Document.addChangeLogEntry(childDoc, 'orderChanged', {
					from: childDoc.order,
					to: newOrder
				});
			
				childDoc.order = newOrder;
				ret.push(iid);
			}
		}
    	
    	return ret;
	}
	
	/**
	 * Deselect all items.
	 */
	resetSelectedState() {
		this.setSelected();
	}
	
	/**
	 * Calls an options dialog at the given place.
	 */
	callOptionsWithId(ids, pageX, pageY) {
		this.behaviour.saveScrollPosition();
		
		Notes.getInstance().callOptions(ids, pageX, pageY);
		
		this.behaviour.callItemOptions(ids, pageX, pageY);

		this.showRootOptions(false);
	}
	
	/**
	 * Refreshes all appearance attributes of the ID and its children
	 */
	refreshColors(id, element) {
		var that = this;
		
		var recursive = this.behaviour.enableRecursiveColors();

		// Helpers to get the colors recursively
		function getBackColor(doc) {
			if (!doc) return false;
			if (doc.backColor) return doc.backColor;
			return recursive ? getBackColor(doc.parentDoc) : false;
		}
		function getColor(doc) {
			if (!doc) return false;
			if (doc.color) return doc.color;
			return recursive ? getColor(doc.parentDoc) : false;
		}

		// Callback for setting the item colors
		function setColor(doc, lvl) {
			var bcol = getBackColor(doc);
			var el = element ? element : that.getItemContent(doc._id);
			that.behaviour.colorItem(el, doc, bcol, true); 
		
			var col = getColor(doc);
			var el = element ? element : that.getItemContent(doc._id);
			that.behaviour.colorItem(el, doc, col, false); 
		}
		
		if (element && id) {
			var doc = Notes.getInstance().getData().getById(id);
			setColor(doc, doc.level);
		} else {
			if (id) {
				Notes.getInstance().getData().applyRecursively(id, setColor);
			} else {
				var children = Notes.getInstance().getData().getChildren("");
				for(var a in children) {
					Notes.getInstance().getData().applyRecursively(children[a]._id, setColor);
				}
			}
		}
	}
}