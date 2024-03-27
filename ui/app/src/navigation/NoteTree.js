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
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
		
		this.treeNavContainerId = "treenav";
		this.treeContainerId = "treeContainer";
		this.treeGridElementId = "treeview";
		
		this.treeRootModeSwitchContainer = "treeRootModeSwitchContainer";
		this.treeRootSettingsSwitchContainer = "treeRootSettingsSwitchContainer";
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
		this.#app.state.restoreTreeState();

		// Linkage modes
		this.updateLinkageButtons();

		this.#app.restoreEditorLinkage();

		var ret = null;  // Promise to return
		if (!this.grid) {
			// Clear DOM elements
			$('#' + this.treeGridElementId).empty();
		
			// Reset additional content
			$('#' + this.treeRootTopSwitchContainer).empty();
			
			// Callback to the behaviour implementation before we start building the grid
			this.behaviour.beforeInit();
			
			// Create Muuri instance
			this.grid = new MuuriGrid(
				this.#app, 
				'#' + this.treeGridElementId, 
				{
					dragHandle: '.' + this.behaviour.getDragMarkerClass(),
					contentClass: this.behaviour.getItemContentClass(),
					moveIntoClass: this.behaviour.getMoveIntoClass(),
					dragDelayMillis: this.#app.device.isTouchAware() ? 0 : this.#app.state.getViewSettings().dragDelayMillis,
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
						that.#app.hideOptions();
						
						return that.behaviour.isDropAllowed(src, tar, dropInto); 
					},
					
					onFinishCallback: function(items) {
						that.behaviour.onLayoutFinish(items);
					},
					
					layoutCallback: this.behaviour.getLayoutCallback(),
					sortData: this.behaviour.getSortFunctions(),
				}
			);
				
			// Register right click event to create new item on grid
			$('#' + this.treeContainerId).off('contextmenu');
			$('#' + this.treeContainerId).contextmenu(function(e) {
        		e.preventDefault();
        		e.stopPropagation();

        		that.#app.hideOptions();
        		
        		that.block();
				that.#app.view.triggerCreateItem(that.behaviour.getNewItemParent())
				.then(function(data) {
					that.unblock();
					if (data.message) {
						that.#app.view.message(data.message, "S");
					}
				})
				.catch(function(err) {
					that.unblock();
					that.#app.errorHandler.handle(err);
				});
        	});
			
			// Back to root on grid double click
			$('#' + this.treeContainerId).off('dblclick');
			$('#' + this.treeContainerId).on('dblclick', function(event) {
				event.stopPropagation();
				
				that.#app.hideOptions();
				
				that.resetScrollPosition('all');
				that.behaviour.onNavigationDoubleClick(event);
			});
			
			// Deselect handler (triggered when the user clicks on the empty root options bar)
			$('#' + this.treeNavContainerId).off('click');
			$('#' + this.treeNavContainerId).on('click', function(e) {
				e.stopPropagation();
				
				that.#app.setFocus(Notes.FOCUS_ID_NAVIGATION);
				
				if (that.blockDeselectCallback) {
					// This is used so that after certain events, the deselect handler is not executed to not get in the way.
					// Espacially after moving items.
					that.blockDeselectCallback = false;
					return;
				}
				that.#app.hideOptions();
				that.resetSelectedState();
			});
			
			// Reset selection
			this.setSelected();
			
			// Callback to the behaviour implementation after initialization
			this.behaviour.afterInit();

			ret = this.filter(true);
		} else {
			ret = this.filter(noAnimation);
		}
		
		that.#app.settings.apply();
		
		this.updateFavorites();
		
		// Callbacks for color picking
		that.#app.registerOptionsCallbacks({
			id: 'tree',
			
			onColorInputPrepare: function(doc, back, input) {
				that.setSelected();
				that.behaviour.beforeColorPicker(doc._id, input, back);
			},
			
			onColorInputUpdate: function(doc, back, input) {
				that.refreshColors(doc._id);
			}
		});
		
		that.#app.update();
		
		this.unblock();
		
		this.prepareDomItems();
		
		return ret;
	};	
	
	/**
	 * Just update sorting.
	 */
	updateSort() {
		this.filter(true);
	}
	
	/**
	 * Ready to show favorites array, including sorting and pinned (starred) docs.
	 */
	getFavorites() {
		var d = this.#app.data;
		
		// Add favorites and starred documents with ranks higher than the normal favs, last changed first.
		var starred = d.getStarredDocs();
		
		var starredSorted = [];
		for (var s in starred) {
		    starredSorted.push({
				id: starred[s]._id,
				rank: starred[s].timestamp || 0,
			});
		}

		// Should the currently opened document be shown in the favorites?
		var currentId = this.#app.paging.getCurrentlyShownId(true);
		var showCurrentInFavorites = !this.#app.state.getViewSettings().dontShowCurrentInFavorites;
		if (showCurrentInFavorites) currentId = false;
		
		// Get favorites as array
		var favorites = this.#app.state.getFavorites();
		var favsSorted = [];
		for (var prop in favorites) {
		    if (favorites.hasOwnProperty(prop)) {
		        var fav = favorites[prop];
				if (!fav) continue;
				if (currentId && (currentId == fav.id)) continue;

				var doc = d.getById(fav.id);
				if (!doc) continue;
				if (doc.deleted) continue;
				
				var found = false;
				for(var i in starredSorted) {
					if (starredSorted[i].id == fav.id) {
						// Already listed in the starred array
						found = true;
						break;
					}
				}
				
				if (!found)	favsSorted.push(fav);
		    }
		}
		
		// Sort
		function compareFavs(b, a) {
			return (a.rank ? a.rank : 0) - (b.rank ? b.rank : 0); 
		}
		
		favsSorted.sort(compareFavs);
		starredSorted.sort(compareFavs);

		return {
			starred: starredSorted,
			favorites: favsSorted
		}
	}
	
	/**
	 * Updates the favorites bar
	 */
	updateFavorites() {
		var favBar = $('#favBar');
		if (!favBar) return;

		var that = this;
		function clear() {
			// Clear content and hide at first
			favBar.empty();
			favBar.css('height', 'auto');
			that.showFavorites(false, true);
		}
		
		var d = this.#app.data;
		if (!d) {
			clear();			
			return;
		}
		
		// We have favorites: Check if the user wants to see them
		var showFavorites = !this.#app.state.getViewSettings().dontShowFavorites;
		if (!showFavorites) {
			clear();				
			return;
		}

		const favs = this.getFavorites();
		
		if ((favs.favorites.length == 0) && (favs.starred.length == 0)) {
			clear();				
			return;
		}
		
		// Check if there have been changes
		var cmp = Tools.hashCode(JSON.stringify(favs));
		if (this.lastRenderedFavs == cmp) {
			return;
		}
		this.lastRenderedFavs = cmp;
		clear();
		
		// Changed favorites: Update them. First we need a container and some other elements.
		var favSize = this.#app.state.getViewSettings().favoritesSize;

		const teaserWidth = Config.favoritesTeaserWidth;   // Width of the teasers
		const margin = this.#app.device.isLayoutMobile() ? Config.favoritesMarginMobile : Config.favoritesMarginDesktop;
		var leftTeaser = $('<div class="navteaser beforeFavScrollTeaser"></div>')
			.css('height', (favSize + margin) + 'px')
			.css('width', teaserWidth);
		var rightTeaser = $('<div class="navteaser afterFavScrollTeaser"></div>')
			.css('height', (favSize + margin) + 'px')
			.css('width', teaserWidth);
			
		const teaserFadeWidth = Config.favoritesTeaserFadeStartWidth;  // Scroll position at which the fade of the teaser starts
		function updateTeasers(container) {
			var maxScrollLeft = cont.prop('scrollWidth') - container.outerWidth();
			if (maxScrollLeft <= 0) {
				leftTeaser.css('opacity', 0);
				rightTeaser.css('opacity', 0);
				return;
			}
			var pos = container.scrollLeft();
			
			if (pos <= teaserFadeWidth) {
				var perc = pos / teaserFadeWidth;  // [0..1]
				leftTeaser.css('opacity', perc);
			} else {
				leftTeaser.css('opacity', 1);
			}
			
			var rightPos = maxScrollLeft - pos;
			if (rightPos <= teaserFadeWidth) {
				var perc = rightPos / teaserFadeWidth;  // [0..1]
				rightTeaser.css('opacity', perc);
			} else {
				rightTeaser.css('opacity', 1);
			}
		}
		
		var cont = $('<div class="favoritesContainer"></div>')
			.scroll(function() {
				updateTeasers(cont);
			});
		
		favBar.css('height', (favSize + margin * 2) + 'px');
		cont.css('height', (favSize + margin) + 'px');
		
		var favoritesNum = this.#app.state.getViewSettings().favoritesNum;

		// Add the favorites to the bar
		for(var i=0; i<favs.starred.length; ++i) {
			this.addFavoriteToBar(cont, favs.starred[i]);
		}
		for(var i=0; i<favs.favorites.length && i<favoritesNum; ++i) {
			this.addFavoriteToBar(cont, favs.favorites[i]);
		}

		// Teasers
		favBar.append(
			cont,
			leftTeaser,
			rightTeaser
		);
		
		setTimeout(function() {
			updateTeasers(cont);
		}, 0);

		// Show favorites		
		this.showFavorites(true);
	}
	
	/**
	 * Reset all buffers of favorites rendering.
	 */
	resetFavoriteBuffers() {
		this.lastRenderedFavs = false;
	}
	
	/**
	 * Gets the text to show (including <br> breaks)
	 */
	getFavoriteText(doc) {
		if (!doc || !doc.name) return "[MISSING TEXT]";
		
		var nameSplit = doc.name.split(" ");
		if (nameSplit.length == 0) return "[MISSING TEXT]";
		
		var favSize = this.#app.state.getViewSettings().favoritesSize;
		
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
		
		var data = this.#app.data;
		
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
	addFavoriteToBar(container, favEntry) {
		var data = this.#app.data;
		if (!data) return;
		
		var doc = data.getById(favEntry.id);
		if (!doc) return;
		
		var favSize = this.#app.state.getViewSettings().favoritesSize;
		
		var nameHtml = this.getFavoriteText(doc);
		
		var el = $('<div class="favoriteItem"></div>')
			.css('width', favSize + 'px')
			.css('height', favSize + 'px')
			.css('margin', '2px')
			.data('id', favEntry.id)
			.append(
				// Text
				$('<div class="favoriteItemText"></div>')
				.css('font-size', (this.getTreeTextSize() * 0.7) + 'px')
				.html(nameHtml),
				
				// Star
				!doc.star ? null : $('<div class="starredFavorite fa fa-star"></div>')
				.css('color', doc.color ? doc.color : 'black')
				.css('font-size', (favSize / 10) + 'px'),
				
				// Selection overlay
				$('<div class="selectedFavorite"></div>')
			)
			
		var that = this;
		function handleFavContext(event) {
			event.stopPropagation();
			event.preventDefault();
			
			var data = $(event.currentTarget).data();
			
			that.#app.callOptions([data.id], Tools.extractX(event), Tools.extractY(event), {
				showInNavigation: false,      // Show in Navigation (default: hidden)
				noMove: true,                // Hide move option
				noCopy: true,                // Hide copy option
				noDelete: true,              // Hide delete option
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

				var d = that.#app.data;
				var data = $(event.currentTarget).data();
				var targetDoc = Document.getTargetDoc(d.getById(data.id));

				/*
				if (that.behaviour.hasChildren(targetDoc)) {
					that.open(targetDoc._id);											
				} else {
					that.focus(targetDoc._id);
				}*/	

				that.#app.routing.call(targetDoc._id);
				that.itemClicked(event, data.id);
			},
			
			delayedHoldCallback: handleFavContext,
			delayHoldMillis: 600
		});

		container.append(
			el
		);
					
		Document.setItemBackground(doc, el, doc.backColor ? doc.backColor : 'white');
		if (doc.color) el.css('color', doc.color);
	}
	
	/**
	 * Removes selection mark from favorites.
	 */
	deselectFavorites() {
		$('.selectedFavorite').css('display', 'none');
	}

	/**
	 * Updates the grid item DOM to match the currently visible 
	 * items before (and after) filter() is actually called on the grid.
	 */
	updateDomItems(add) {
		var data = this.#app.data;
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
				if (currentItems[i].docId == id) {
					return currentItems[i];
				}
			}
			return null;
		}
		
		function getItemIndex(item) {
			var ret = 0;
			for(var i in currentItems) {
				if (currentItems[i].docId == item.docId) {
					return ret + 1;
				}
				ret++;
			}
			return 0;
		}
		
		var maxSearchResults = this.#app.settings.settings.maxSearchResults;
		if (!maxSearchResults) maxSearchResults = 20;
		
		var cnt = 0;
		var itemsToShow = [];
		data.each(function(doc) {
			var visible = that.behaviour.isItemVisible(doc, searchText);
			var item = getItemById(doc._id); //doc.navMuuriItem ? doc.navMuuriItem : null; 
						
			if (visible) {
				cnt++;
				if (!item && add && (!searchText || (cnt <= maxSearchResults))) {
					// Does not exist: Create and add it
					item = that.createItem(doc)[0];
					
					// Set invisible at first: This prevents unnecessary forced reflows.
					$(item).css('display', 'none');
					
					var newIndex = 0;
					if (doc.parent) {
						var parentItem = getItemById(doc.parent);
						if (parentItem) {
							newIndex = that.behaviour.getNewItemStartIndex(getItemIndex(parentItem));
						}
					}
					
					var itm = that.grid.grid.add([item], {
						index: that.behaviour.getInitialItemOrder(doc),
						layout: false,
						index: newIndex
					})[0];
					
					// We store the document ID on the Muuri item directly for faster access
					itm.docId = doc._id;
					
					// Remember Muuri items for later showing them at once
					itemsToShow.push(itm);
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
				
		var additionalItems = this.behaviour.afterUpdateItems();
		for (var it in additionalItems) {
			itemsToShow.push(additionalItems[it]);
		}

		// Show items at once: This prevents unnecessary forced reflows.
		for(var it in itemsToShow) {
			const item = itemsToShow[it];			
			this.grid.grid.show(item);
		}
	}

	/**
	 * Create a grid item from the passed document 
	 */
	createItem(doc) {
		const useBuffer = Config.useBufferedNavigationItemElements;
		if (useBuffer && doc.navItemElement) {
			//console.log("Use buffered item: " + doc._id);
			return doc.navItemElement;
		}
		
		var data = this.#app.data;
		if (!data) return;
		
		var li = $('<div class="' + this.behaviour.getItemContentClass() + '" />');
		var licont = $('<div class="' + this.behaviour.getItemClass() + '" id="node_' + doc._id + '" />').append(li);
		
		// Set the document ID as data attribute for reference
		li.attr('data-id', doc._id);

		// Conflict icon
		var conflictIcon = "";
		if (data.hasConflicts(doc._id, true)) {
			conflictIcon = '<span class="fa fa-exclamation conflictIcon itemAdditionalIcon"></span>';
		}
		
		// Reference icon
		var referenceIcon = "";
		if (doc.type == 'reference') {
			referenceIcon = '<span class="fa fa-long-arrow-alt-right itemAdditionalIcon"></span>';
		}
		
		// Build inner DOM of node
		this.behaviour.setupItemContent(li, doc, referenceIcon + conflictIcon, '');
		
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
					
					that.#uploadFilesHandler(files, doc._id);
				}
			}
		]);
		
		if (useBuffer) {
			doc.navItemElement = licont;	
		}		
		
		// Return element
		return licont;
	}
	
	/**
	 * Prepare DOM item for all documents. 
	 */
	prepareDomItems() {
		if (!Config.preRenderNavigationDomItemsInterval) return;
		
		const p = this.#app.db.profileHandler.getCurrentProfile();
		if (!p.autoSync) {
			//console.log(" -> Skipping pre-rendering of navigation items");
			return;
		}
	
		const data = this.#app.data;
		if (!data) return;
		
		//console.log(" -> Starting pre-rendering of navigation items (interval: " + Config.preRenderNavigationDomItemsInterval + "ms, " + data.data.size + " documents)");
		
		this.preRenderingStartTime = Date.now();
		this.preRenderingNumDocs = 0;
		this.#doPrepareDomItems();
	}
	
	#doPrepareDomItems() {
		var that = this;
		
		const data = this.#app.data;
		if (!data) return;
		
		for(var [key, doc] of data.data) {
			if (doc.navItemElement) continue;
			var id = doc._id;
			
			if (that.preRenderingNumDocs > data.data.size * 1.4) {
				//const passedSecs = (Date.now() - this.preRenderingStartTime) / 1000;
				//console.log(" -> Pre-rendering of navigation items forcefully finished (" + that.preRenderingNumDocs + " docs processed in " + passedSecs.toFixed(2) + "s).");
				return;
			}
			
			setTimeout(function() {
				//console.log(" -> Pre-creating DOM element for " + id);
				that.preRenderingNumDocs++;
				
				var doc = data.getById(id);
				if (doc) {
					// Create DOM for item in advance
					that.createItem(doc);							
					
					// Restart process until all docs are finished
					that.#doPrepareDomItems();				
				}
								
						
			}, Config.preRenderNavigationDomItemsInterval); 
			
			// We just get the next document without a DOM element, and process it.
			return;
		}		
		
		//const passedSecs = (Date.now() - this.preRenderingStartTime) / 1000;
		//console.log(" -> Pre-rendering of navigation items finished (" + that.preRenderingNumDocs + " docs processed in " + passedSecs.toFixed(2) + "s).");
	}
	
	/**
	 * Common stuff used by all footer action handlers
	 */
	commonButtonHandler(event) {
		event.stopPropagation();
		
		this.#app.hideOptions();
		this.#app.setFocus(Notes.FOCUS_ID_NAVIGATION);
	}

	/**
	 * Handlers for all footer actions
	 */
	backHandler(event) {
		this.commonButtonHandler(event);
		this.behaviour.backButtonPushed(event);
	}
	
	forwardHandler(event) {
		this.commonButtonHandler(event);
		this.behaviour.forwardButtonPushed(event);
	}
	
	homeHandler(event) {
		this.commonButtonHandler(event);
		this.behaviour.homeButtonPushed(event);
	}
	
	createHandler(event) {
		this.commonButtonHandler(event);
		
		var that = this;
		this.#app.view.triggerCreateItem(this.behaviour.getNewItemParent())
		.then(function(data) {
			if (data.message) {
				that.#app.view.message(data.message, "S");
			}
		})
		.catch(function(err) {
			that.#app.errorHandler.handle(err);
		});
	}
	
	searchNotebookHandler(event) {
		this.commonButtonHandler(event);

		this.resetScrollPosition(this.getFocusedId());
		$('#treeSearch').focus();
	}
	
	favoritesHandler(event) {
		this.commonButtonHandler(event);
		
		this.#app.editorFavoritesButtonHandler(event);
	}
	
	settingsHandler(event) {
		const newState = !this.isSettingsPanelVisible();

		this.commonButtonHandler(event);
		
		if (newState) {
			this.buildSettingsPanel();
			this.showSettingsPanel(true);
		} else {
			this.showSettingsPanel(false);
		}
	}
	
	linkageHandler(event) {
		this.commonButtonHandler(event);
		this.toggleLinkToEditor();
	}
	
	/**
	 * Set up the DOM tree for the tree.
	 */
	setupDom() {
		var that = this;
		
		/**
		 * Handlers for the search bar
		 */
		function searchFocusHandler(event) {
			event.stopPropagation();
			that.#app.hideOptions();
			if (that.behaviour) that.behaviour.saveScrollPosition();
			that.showSearchProposals(true);
		}
		
		function searchInputHandler(event) {
			event.stopPropagation();
			that.#app.hideOptions();
			that.updateSearch();
			that.behaviour.afterSetSearchText(that.getSearchText());
			that.showSearchProposals(that.getSearchText().length == 0);
		}
		
		function searchBlurHandler(event) {
			event.stopPropagation();
			if ($('#treeSearchProposals:hover').length == 0) {
				that.showSearchProposals(false);
			}
		}
		
		function searchKeydownHandler(event) {
			if(event.which == 27){
				event.stopPropagation();
				that.#app.hideOptions();
				that.setSearchText('');
				that.showSearchProposals(false);
		    }
		}
		
		function searchCancelHandler(event) {
			event.stopPropagation();
			that.#app.hideOptions();
			that.setSearchText('');
		}

		// Build DOM
		$('#' + this.treeNavContainerId).append(
			$('<div id="' + this.treeContainerId + '"></div>').append(
				// Search bar
				$('<div id="searchBarTree" class="searchBar searchBarTree"></div>').append(
					// Search input
					$('<input autocomplete="off" type="text" id="treeSearch" placeholder="Type text to search..." />')
					.on('focus', function(e) { return searchFocusHandler(e); })
					.on('input', function(e) { return searchInputHandler(e); })
					.on('blur', function(e) { return searchBlurHandler(e); })
					.on('keydown', function(e) { return searchKeydownHandler(e); }),
					
					// Cancel button for search
					$('<div id="searchCancelButton" class="searchCancelButton fa fa-times"></div>')
					.on('click', function(e) { return searchCancelHandler(e); }),
					
					// Search proposals
					$('<div id="treeSearchProposals"></div>')
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
				
				$('<span id="treeteasertext" style="display: none;">No items to show</span>')
			),
			
			$('<div id="navFooter" class="footer"></div>'),
			
			$('<div id="treeSettingsPanel"></div>')
				.on('click', function(event) {
					event.stopPropagation();
				}),
			
			$('<div id="treeblock"></div>')
		);

		// Drop files into the container of the tree
		Tools.dropFilesInto([
			{
				elements: $('#' + this.treeNavContainerId),
				callback: function(files, definition, element) {
					console.log("Dropped " + files.length + " files into navigation container");
					that.#uploadFilesHandler(files, that.behaviour.selectedParent); 
				}
			}
		]);

		// Action callbacks
		/*this.#app.callbacks.registerCallback(
			'tree',
			'requestTree',
			function(data) {
				that.destroy();
				that.init();
			}
		);*/
		this.#app.callbacks.registerCallback(
			'tree',
			'setStar',
			function(doc) {
				that.refresh(); //updateFavorites();
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'loadDocument',
			function(docs) {
				that.updateSelectedState(true);
				for(var d in docs) {
					var persDoc = that.#app.data ? that.#app.data.getById(docs[d]._id) : null;
					if (persDoc) {
						that.behaviour.afterRequest(persDoc._id);
					}
				}
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'openDocument',
			function(doc) {
				that.#app.triggerUnSyncedCheck();
				that.#app.addFavorite(doc);
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'create',
			function(newIds) {
				that.destroy();
				that.init();
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'save',
			function(doc) {
				that.behaviour.afterSave(doc);
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'moveDocumentBeforeSave',
			function(data) {
				// Block further actions until the move has been finished and the new tree has been reloaded
				that.behaviour.afterDropBeforeSave(data.docsSrc, data.docTarget, data.moveToSubOfTarget);

			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'moveDocumentAfterSave',
			function(data) {
				return that.behaviour.afterDrop(data.docsSrc, data.docTarget, data.moveToSubOfTarget);
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'requestConflict',
			function(data) {
				that.updateSelectedState(true);
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'delete',
			function(docs) {
				that.destroy();
				that.init();
				
				that.behaviour.afterDelete(docs);
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'rename',
			function(data) {
				that.destroy();
				that.init();
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'copy',
			function(data) {
				that.destroy();
				that.init();
			}
		);
		this.#app.callbacks.registerCallback(
			'tree',
			'importFinished',
			function(data) {
				that.destroy();
				that.init(true);
			}
		);
	}

	/**
	 * Handler for uploading files via drag and drop
	 */
	async #uploadFilesHandler(files, defaultId) {
		try {
			var id = await this.#app.view.dialogs.promptSelectDocument('Add ' + files.length + ' files?', {
				defaultTargetId: defaultId,
				excludeTypes: ['reference']
			});
				
			await this.#app.actions.attachment.uploadAttachments(id, files);
			
			// Show the target document
			this.#app.routing.call(defaultId);
			
		} catch(err) {
			this.#app.errorHandler.handle(err);
		}
	}
	
	/**
	 * Set up the footer for mobiles.
	 */	
	setupFooter() {
		var that = this;
		
		//if (this.#app.useFooter()) {
		this.#app.setFooterContent([
			// Back Button
			$('<div class="fa fa-chevron-left footerButton" id="treeBackButton" data-toggle="tooltip" title="Navigate back"></div>')
				.on('click', function(e) { return that.backHandler(e); }),
				
			// Forward Button
			$('<div class="fa fa-chevron-right footerButton" id="treeForwardButton" data-toggle="tooltip" title="Navigate forward"></div>')
				.on('click', function(e) { return that.forwardHandler(e); }),

			// Home Button
			$('<div class="fa fa-home footerButton" id="treeHomeButton" data-toggle="tooltip" title="Go to the notebook home in the navigation panel"></div>')
				.on('click', function(e) { return that.homeHandler(e); }),
			
			// Create note
			$('<div class="fa fa-plus footerButton" data-toggle="tooltip" title="Create new item"></div>')
				.on('click', function(e) { return that.createHandler(e); }),
				
			// Search
			$('<div class="fa fa-search footerButton" data-toggle="tooltip" title="Search notebook"></div>')
			.on('click', function(e) { return that.searchNotebookHandler(e); }) 
			//.on('click', this.favoritesHandler) 
			
			// Link navigation to editor Button
			/*$('<div data-toggle="tooltip" title="" class="fa fa-link footerButton" id="treeLinkButton"></div>')
				.on('click', function(e) { return that.linkageHandler(e); })*/
		]);/*
		} else {
			this.#app.setFooterContent();
		}*/
	}
	
	/**
	 * Toggles linkage to the editor.
	 */
	toggleLinkToEditor() {
		var linkToEditor = this.#app.state.getLinkageMode('nav');
		
		linkToEditor = ((linkToEditor == 'on') ? 'off' : 'on');
		
		this.#app.state.setLinkageMode('nav', linkToEditor);			
		
		this.updateLinkageButtons();
		
		if (linkToEditor == 'on') {
			var id = this.#app.paging.getCurrentlyShownId();
			if (id) this.editorOpened(id);	
		}
	}
	
	updateLinkageButtons() {
		if (this.#app.device.isLayoutMobile()) {
			$('#treeLinkButton').css('display', 'none');
			return;
		}
		
		var linkToEditor = this.#app.state.getLinkageMode('nav')
		$('#treeLinkButton').css('display', (!this.supportsLinkNavigationToEditor()) ? 'none' : 'block');
		
		$('#treeLinkButton').css('background-color', '');
		$('#treeLinkButton').css('color', (linkToEditor == 'on') ? '#c40cf7' : '');			
		
		$('#treeLinkButton').attr('title', (linkToEditor == 'on') ? 'Unlink navigation from editor' : 'Link navigation to editor');
	}
	
	supportsLinkEditorToNavigation() {
		if (!this.behaviour) return false;
		return this.behaviour.supportsLinkEditorToNavigation();
	}
	
	supportsLinkNavigationToEditor() {
		if (!this.behaviour) return false;
		return this.behaviour.supportsLinkNavigationToEditor();
	}
	
	/**
	 * Used by the behaviours to get the currently shown ID (editors only)
	 */
	getCurrentlyShownId() {
		return this.#app.paging.getCurrentlyShownId(true);
	}
	
	/**
	 * Called to open a document from linkage. Called by the behaviours which support this linkage.
	 */
	openNodeByNavigation(id) {
		if (!id) return;
		if (!this.supportsLinkEditorToNavigation()) return;

		if (this.#app.paging.isEditorLoaded()) {
			// If a note editor is loaded, we just redirect to the document. To prevent endless 
			// re-linking, we also remember the id which has been called by linkage.
			this.lastOpenedLinkTarget = id;

			this.openNode(id);
			
		} else {
			// Other pages: Call the respective callback if the page implements it
			var page = this.#app.paging.getCurrentPage();
			if (page && 
			       (typeof page.supportsLinkageFromNavigation == 'function') && 
			       page.supportsLinkageFromNavigation() &&
			       (typeof page.updateFromLinkage == 'function')
			) {
				this.lastOpenedLinkTarget = id;
				
				page.updateFromLinkage(id);
			}
		}
	}
	
	/**
	 * If enabled, navigates to the passed document. Called by opening a document in the editor.
	 */
	editorOpened(id) {
		if (!id) return;
		if (!this.supportsLinkNavigationToEditor()) return;
		
		// If this is a roundtrip call, return here. Reset the flag anyway.
		if (this.lastOpenedLinkTarget == id) {
			this.lastOpenedLinkTarget = false;
			return;
		}
		this.lastOpenedLinkTarget = false;
		
		var linkToEditor = this.#app.state.getLinkageMode('nav')
		if (linkToEditor == 'on') {
			this.focus(id, true);
		}			
	}
	
	/*addPageToHistory(url) {
		this.behaviour.addPageToHistory(url);
	}*/
	
	/**
	 * Called after the back button in the app header has been pushed.
	 */
	appBackButtonPushed() {
		this.behaviour.appBackButtonPushed();
	}
	
	/**
	 * Returns (if the behaviour supports history) if there is a way back.
	 */
	historyCanBack() {
		return this.behaviour.historyCanBack();	
	}
	
	/**
	 * Called after the forward button in the app header has been pushed.
	 */
	appForwardButtonPushed() {
		this.behaviour.appForwardButtonPushed();
	}
	
	getSettingsPanelContentTableRows(prefixText) {
		if (!this.behaviour) return [];
		if (typeof this.behaviour.getSettingsPanelContentTableRows !== 'function') return [];
		return this.behaviour.getSettingsPanelContentTableRows(prefixText);
	}
	
	/**
	 * Builds the settings panel part which depends on the behaviour.
	 */
	buildSettingsPanel() {
		$('#treeSettingsPanel').empty();
		if (!this.behaviour) return;
			
		var that = this;
		$('#treeSettingsPanel').append(
			$('<table></table>')
			.append(
				$('<tbody></tbody>')
				.append(
					$('<tr></tr>')
					.append(
						$('<td>Mode</td>'),
						$('<td></td>').append(
							Behaviours.getModeSelector('treeModeSelectorList', this.#app.state.getViewSettings().navMode)
							.on('change', function(event) {
								that.#app.hideOptions();
								
								var s = that.#app.state.getViewSettings();
								s.navMode = this.value; 
								that.#app.state.saveViewSettings(s);
		
								that.refresh();
							})
						)
					),
					this.getSettingsPanelContentTableRows()
				)
			)
		);
	}
	
	/**
	 * Show and hide the tree settings panel.
	 */
	showSettingsPanel(doShow) {
		$('#treeSettingsPanel').css('display', doShow ? 'block' : 'none');
		
		if (doShow) {
			$('#treeSettingsPanel').css('bottom', this.#app.device.isLayoutMobile() ? '8px' : ((this.#app.getRoundedButtonSize() * 2 + 30) + 'px'));
		}
	}
	
	isSettingsPanelVisible() {
		return $('#treeSettingsPanel').css('display') != 'none';
	}
	
	/**
	 * Set favorites visibility
	 */
	showFavorites(show, dontReset) {
		if (show) {
			$('#favBar').show();
		} else {
			$('#favBar').hide();
			if (!dontReset) this.resetFavoriteBuffers();
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
	focus(id, fromLinkage) {
		this.behaviour.focus(id, fromLinkage);
		
		var bookmark = this.consumeBookmarkDocumentForNextFocus();
		if (bookmark) {
			this.#setSelectedAndScrollTo(bookmark);
		}
		
		this.#app.toggleShowNavigation(true);
	}
	
	#setSelectedAndScrollTo(id) {
		var that = this;
		setTimeout(function() {
			that.setSelected(id);				
			that.scrollToDocument(id);				
		}, MuuriGrid.getAnimationDuration(this.#app) * 1.4);
	}
	
	/**
	 * Returns the currently focussed ID if this is supported by the behaviour, or '' if not.
	 */
	getFocusedId() {
		if (!this.behaviour) return false;
		return this.behaviour.getFocusedId();
	}
	
	/**
	 * This selects the parent of the passed document and sets the doc itself selected, all
	 * by calling a route.
	 */
	highlightDocument(id, noRouting) {
		if (!id) {
			if (noRouting) {
				this.focus();
			} else {
				this.#app.home();
			}
			return;
		}
		var doc = this.#app.data.getById(id);
		if (!doc) {
			this.#app.view.message("Document " + id + " not found");
			return;
		}	
		
		if (noRouting) {
			this.focus(doc.parent);
			this.#setSelectedAndScrollTo(id);
		} else {
			this.bookmarkSelectedForNextFocus(id);		
			this.#app.routing.callProfileRootWithSelectedId(doc.parent);	
		}
	}
	
	/**
	 * Saves a bookmark in local memory which will trigger the next focus() call to select the 
	 * document. The bookmark will be removed after this has happened.
	 * See als consumeBookmarkDocumentForNextFocus().
	 */
	bookmarkSelectedForNextFocus(id) {
		var tmpVs = this.#app.state.getTemporaryViewSettings();
		
		tmpVs.bookmarkSelectedDocument = id;
		
		this.#app.state.saveTemporaryViewSettings(tmpVs);
	}
	
	consumeBookmarkDocumentForNextFocus() {
		var tmpVs = this.#app.state.getTemporaryViewSettings();
		
		var ret = tmpVs.bookmarkSelectedDocument ? tmpVs.bookmarkSelectedDocument : null;
		
		tmpVs.bookmarkSelectedDocument = null;
		this.#app.state.saveTemporaryViewSettings(tmpVs);
		
		return ret;
	}
	
	/**
	 * Opens the given document in the navigation.
	 */
	open(id) {
		this.behaviour.open(id);
	}
	
	/**
	 * Get behaviour instance depending on the view mode. Called on init().
	 */
	initBehaviour() {
		var cs = this.#app.state.getViewSettings();
		if (!this.behaviour || (cs.navMode != this.navMode)) {
			this.destroy();
			this.behaviour = Behaviours.get(this.#app, cs.navMode, this);
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
			this.behaviour = null;
		}
	}
	
	/**
	 * Show or hide the root options
	 */
	showRootOptions(show) {
		$('#' + this.treeRootModeSwitchContainer).css('display', show ? 'block' : 'none');
		$('#' + this.treeRootSettingsSwitchContainer).css('display', show ? 'block' : 'none');
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
		this.#app.state.saveTreeState();
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
	openNode(id) { //, noFocus) {
		//if (!noFocus) this.behaviour.focus(id);
		
		// Open the note/document
		this.#app.routing.call(id);			
	}
	
	/**
	 * Set the currently selected item by ID.
	 */
	setSelected(id) {
		var alreadySelected = false;
		if (this.selected == id) {
			alreadySelected = true;
		}
		
		var old = this.getItemContent(this.selected)
		if (old) {
			this.behaviour.deselectItem(old);
		}

		this.selected = id;
		
		this.#app.state.saveTreeState();
		
		if (this.selected) {
			var item = this.getItemContent(this.selected)
			if (!item) return;
			
			this.behaviour.selectItem(item, id);
		}
		
		if (!alreadySelected) {
			this.filter();			
		}
	}
	
		/**
	 * Scroll so that the passed document is visible
	 */
	scrollToDocument(id) {
		var el = this.getItemContent(id);
		if (!el) return;
		if (!el[0]) return;
		
		el[0].scrollIntoView({block: "center"});
		
		this.behaviour.saveScrollPosition();
	}
	
	/**
	 * Takes care that the selected item is always the opened note.
	 */
	updateSelectedState(selectOpened) {
		if (!this.grid) return;
		
		// If nothing is selected, select the opened note if any.
		if (selectOpened && !this.selected) {
			var opened = this.#app.paging.getCurrentlyShownId();

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
	 * 
	 * TODO move to settings
	 */
	getTreeTextSize() {
		var g = this.#app.state.getLocalSettings();
		if (g) {
			if (this.#app.device.isLayoutMobile()) {
				if (g.navTextSizeMobile) {
					return parseFloat(g.navTextSizeMobile);
				}
			} else {
				if (g.navTextSizeDesktop) {
					return parseFloat(g.navTextSizeDesktop);
				}
			}
		}
		
		// Default
		return this.#app.device.isLayoutMobile() ? Config.defaultNavigationTextSizeMobile : Config.defaultNavigationTextSizeDesktop;
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
		
		if (this.behaviour) this.behaviour.afterSetTreeTextSize(size);
	}
	
	/**
	 * Returns the width of the nav panel. Only relevant in non-mobile mode.
	 */
	getContainerWidth() {
		var state = this.#app.state.getTreeState();
		return (state && state.treeWidth) ? state.treeWidth : Config.defaultTreeWidth;
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
	setSearchText(txt, data) {
		$('#treeSearch').val(txt);
		
		if (this.behaviour) {
			this.behaviour.afterSetSearchText(txt, data);
		}
		
		if (txt) this.#app.setFocus(Notes.FOCUS_ID_NAVIGATION);
		
		return this.updateSearch();
	}
	
	/**
	 * Update search. 
	 */
	updateSearch() {
		var text = this.getSearchText();
		
		var that = this;
		if (text && (text.length > 0)) {
			// Load all documents
			return new Promise(function(resolve) {
				that.filter(true);
				
				that.#app.state.addSearchProposal(text);
					
				resolve({ ok: true });
			});
		} else {
			// Just filter
			return new Promise(function(resolve) {
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
	
	/**
	 * Shows the search proposal screen.
	 */
	showSearchProposals(doShow) {
		var cont = $('#treeSearchProposals');
		cont.empty();
		
		var that = this;
		if (doShow) {
			// Build DOM for search proposals
			const helpText =  
				'<span class="serachhelptext">Type a text to search for it in all contents and document names. Use the follong prefixes optionally:</span>' + 
				'<br>' + 
				'<ul>' + 
					'<li>' +
						'<b>name:[...]</b> only shows documents which contain the search text in their names' +  
					'</li>' + 
					'<li>' +
						'<b>star:[...]</b> only searches in the contents and names of documents which are pinned to the favorites list' +  
					'</li>' + 
					'<li>' +
						'<b>tag:[...]</b> only shows documents containing the specified hash tag' +  
					'</li>' + 
					'<li>' +
						'<b>type:[...]</b> only shows documents with the specified type (possible types are: note, attachment, reference)' +  
					'</li>' + 
				'</ul>' + 
				'<br>' + 
				'<span class="serachhelptext">Additionally, you can prefix the search with a + or - sign:</span>' + 
				'<br>' + 
				'<ul>' + 
					'<li>' +
						'<b>+[...]</b> searches in the currently visible items only instead of all documents' +  
					'</li>' + 
					'<li>' +
						'<b>-[...]</b> just filters out the items that match the search (also using the currently visible items as basis, not all)' +  
					'</li>' + 
				'</ul>' + 
				'<br>';
				

			var props = this.#app.state.getSearchProposals();
			for(var i in props) {
				if (typeof props[i] != 'object') continue;
				
				cont.append(
					$('<div class="treeSearchHelpItem" data-token="' + props[i].token + '"></div>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var token = $(this).data('token');
						that.setSearchText(token);
						that.showSearchProposals(false);
					})
					.html(props[i].token)
				);
			}
			
			cont.append(
				$('<div class="treeSearchHelpLine"></div>'),
				$('<div class="treeSearchHelpItemPassive"></div>').html(helpText),
			)
			
			cont.css('top', ($('#searchBarTree').height() + 12) + 'px');
		}
		
		cont.css('display', doShow ? 'block' : 'none');
	}
	
	/**
	 * Update the state of history buttons.
	 */
	updateHistoryButtons() {
		this.#app.updateHistoryButtons();
	}
	
	getHistory() {
		return this.behaviour.getHistory();
	}
	
	/**
	 * Returns the child documents as shown by the navigation, in the correct order.
	 */
	getRelatedDocuments(id, options) {
		if (!this.behaviour) throw new Error('Tree not set up yet');
		
		return this.behaviour.getRelatedDocuments(id, options);
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Applies the current filter to the grid. 
	 */
	filter(noAnimations) {
		var that = this;

		if (this.filterRunning) {
			// Already filter running: Specify the next one to perform.
			this.nextFilter = {
				noAnimations: noAnimations,
			};
			return Promise.resolve();
		}
		
		// No filter running: Directly run it. 
		//console.log("Starting new filter (queue length: " + this.filterQueue.length + ")");
		
		this.filterRunning = true;
		return this.#filterInternal(noAnimations)
		.then(function() {
			that.filterRunning = false;
			//console.log("Stopped filter (queue length: " + that.filterQueue.length + ")");
			
			if (that.nextFilter) {
				const noAn = that.nextFilter.noAnimations;
				that.nextFilter = null;
				return that.filter(noAn);
			} else {
				return Promise.resolve();
			}
		});
	}
	
	/**
	 * Internal filter function, only called by the filter promise queue.
	 */
	#filterInternal(noAnimations) {
		if (!this.grid) return Promise.resolve();

		this.behaviour.beforeFilter(noAnimations);
		
		var searchText = this.getSearchText();

		var that = this;
		function doFilter(resolve/*, reject*/) {
			that.updateDomItems(true);
			
			that.grid.grid.filter(function (item) {
				var el = that.getGridItemContent(item);
				var dt = el.data();
				
				var id = dt.id;
				
				var doc = that.behaviour.getById(id);
				var visible = that.behaviour.isItemVisible(doc, searchText); 
				
				if (visible) {
					that.behaviour.setItemStyles(item, doc, $(el).parent(), $(el), searchText);
				}
				return visible;
				
			}, noAnimations ? {
				instant: true,
				layout: "instant",
				onFinish: function() {
					that.updateDomItems(false);
					that.grid.grid.refreshItems();
					that.grid.refresh();
					that.behaviour.afterFilter(noAnimations);
					
					if (that.#app.device.isLayoutMobile()) that.refreshColors();
					//that.behaviour.restoreScrollPosition();
					//console.log("Stop Filter")
					resolve();
				}
			} : {
				onFinish: function() {
					that.updateDomItems(false);
					that.grid.grid.refreshItems();
					that.grid.refresh();
					that.behaviour.afterFilter(noAnimations);
					
					if (that.#app.device.isLayoutMobile()) that.refreshColors();
					//that.behaviour.restoreScrollPosition();
					//console.log("Stop Filter")
					resolve();
				}
			});
		}
		
		if (searchText.length > 0) {
			return this.#app.documentAccess.loadAllDocuments()
			.then(function() { 
				return new Promise(function(resolve/*, reject*/) {
					//console.log("Start Filter")
					doFilter(resolve);
				});
			});
		} else {
			return new Promise(function(resolve/*, reject*/) {
				//console.log("Start Filter")
				doFilter(resolve);
			});
		}
	}
	
	/**
	 * Returns if the document can be moved or if it is just a link or backling etc.
	 * Only true children can be moved.
	 */
	canBeMoved(id) {
		if (!this.behaviour) return false;
		
		return this.behaviour.canBeMoved(id);
	}
	
	/**
	 * Drop action.
	 */
	doDrop(src, tar, moveToSubOfTarget) {
		var srcId = src.data().id;
    	var tarId = tar.data().id;

		var srcDoc = this.#app.data.getById(srcId);
    	var srcName = srcDoc.name;
    	var tarName = tarId ? this.#app.data.getById(tarId).name : 'Notebook root';
    	
    	const srcCanBeMoved = this.canBeMoved(srcId);
    	if (!srcCanBeMoved && moveToSubOfTarget) {
			this.#app.view.message("Cannot move this document.", "I");
			return;
		}
    	
    	var doAsk = srcCanBeMoved && this.#app.settings.settings.askBeforeMoving;
    	if (doAsk && !confirm("Move " + srcName + " to " + tarName + "?")) {
			this.#app.view.message("Moving cancelled.", "I");
			return;
		}
    	
    	var that = this;
    	if (srcCanBeMoved) {
	    	this.#app.actions.document.moveDocuments([srcId], tarId, moveToSubOfTarget)
	    	.catch(function(err) {
	    		that.#app.errorHandler.handle(err);
	    	});
		} else {
	    	this.#app.actions.document.saveChildOrders(srcDoc.parent)
	    	.catch(function(err) {
	    		that.#app.errorHandler.handle(err);
	    	});			
		}
	}
	
	/**
	 * Updates the orders of all visible child items of id in the data model accordingly.
	 * Returns a list of IDs which have been touched.
	 */
	reorderVisibleSiblings(doc, simulate) {
		var no = 1;
    	var all = this.grid.grid.getItems();

    	var ret = [];
    	for(var i in all) {
			var childId = $(this.getGridItemContent(all[i])).data().id;
			if (!childId) continue;
			
			var childDoc = this.#app.data.getById(childId);
			if (!this.behaviour.isItemVisible(childDoc, this.getSearchText())) continue; //childDoc.parent != id) continue;
			
			var parentId = this.behaviour.getParentId(doc);
			var oldOrder = Document.getRelatedOrder(childDoc, parentId);
			var newOrder = no++;
			if (oldOrder != newOrder) {
				/*Document.addChangeLogEntry(childDoc, 'orderChanged', {
					from: oldOrder,
					to: newOrder,
					inRelationTo: parentId
				});*/
			
				if (!simulate) Document.setRelatedOrder(childDoc, parentId, newOrder);
				ret.push(childId);
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
		
		this.#app.callOptions(ids, pageX, pageY);
		
		this.behaviour.callItemOptions(ids, pageX, pageY);

		this.showRootOptions(false);
	}
	
	/**
	 * Refreshes all appearance attributes of the ID and its children
	 */
	refreshColors(id, element) {
		var that = this;
		var d = this.#app.data;
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
		function setColor(doc) {
			var el = element ? element : that.getItemContent(doc._id);
			if (!el) return;
			
			var bcol = getBackColor(doc);
			that.behaviour.colorItem(el, doc, bcol, true); 
		
			var col = getColor(doc);
			that.behaviour.colorItem(el, doc, col, false); 
		}
		
		if (element && id) {
			// Direct call for a given item and document
			var doc = d.getById(id);
			if (doc) {
				setColor(doc);	
			}			
		} else {
			if (id) {
				// Call by ID only: Have to search the document and refresh colors on it and all children
				d.applyRecursively(id, setColor);
			} else {
				// Call for root: Color all documents.
				element = null;

				var children = d.getChildren('');
				for(var a in children) {
					d.applyRecursively(children[a]._id, setColor);
				}
			}
		}
	}
	
	/**
	 * Called by the behaviours on item clicks.
	 */
	itemClicked(event, id) {
		this.#app.setFocus(Notes.FOCUS_ID_NAVIGATION);
	}
}