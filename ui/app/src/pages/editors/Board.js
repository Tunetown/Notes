/**
 * Kanban Board style editor. Inspired by https://codepen.io/niklasramo/pen/BrYaOp
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
class Board {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Board.instance) Board.instance = new Board();
		return Board.instance;
	}
	
	/**
	 * Tells if the editor needs tree data loaded before load() is called.
	 */
	needsTreeData() {
		return true;
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	load(doc) {
		var that = this;

		var n = Notes.getInstance();
		n.setCurrentEditor(this);
		n.setCurrentPage(this);

		this.destroy();

		// Callbacks for color picking
		Notes.getInstance().registerOptionsCallbacks({
			id: 'board',
			
			onColorInputUpdate: function(doc, back, input) {
				that.refreshColors(doc._id);
			},
		});
		
		// Callbacks for actions
		Callbacks.getInstance().registerCallback(
			'board',
			'delete',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'copy',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'moveDocumentAfterSave',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'rename',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'create',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'setBoardBackgroundImage',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'saveLabels',
			function(id) {
				that.refresh();
			}
		);
		Callbacks.getInstance().registerCallback(
			'board',
			'saveLabelDefinitions',
			function(id) {
				that.refresh();
			}
		);
		
		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Board options..." id="boardOptionsButton" class="fa fa-ellipsis-v" onclick="event.stopPropagation();Board.getInstance().callOptions(event);"></div>'), 
		]);
		
		var docs = [doc];
		var children = n.getData().getChildren(doc._id);
		
		for(var c in children) {
			docs.push(children[c]);
			
			var subChildren = n.getData().getChildren(children[c]._id);
			for (var sc in subChildren) {
				docs.push(subChildren[sc]);
			}
		}
		
		return DocumentAccess.getInstance().loadDocuments(docs)
		.then(function(resp) {
			that.setCurrent(doc);
			
			// Build board
			that.buildBoard(doc);
			
			NoteTree.getInstance().updateFavorites();
			
			that.restoreScrollPosition();
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Build the board DOM
	 */
	buildBoard(doc) {
		var n = Notes.getInstance();
		var that = this;
		
		// Build containers
		var dragContainer = $('<div class="board-drag-container"></div>');
		var boardContainer = $('<div class="board"></div>');
		
		$('#contentContainer').empty();
		
		// Add background and content container. Default is light grey.
		var boardBack = $('<div id="boardBackground" style="display:none"></div>');
		$('#contentContainer').css('background', 'lightgrey');
		$('#contentContainer').append(
			boardBack,
			
			$('<div id="board-scroll-container"></div>').append(
				dragContainer,
				$('<div class="board-container"></div>').append(
					boardContainer
				)
			)
		);

		// Right click on background
		$('#contentContainer').contextmenu(function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			n.callOptions([doc._id], Tools.extractX(e), Tools.extractY(e), {
				noCopy: true,
				noMove: true,
				noDelete: true,
				noBgColor: true,
				noColor: true,
				noBgImage: true
			});
		});
		
		// Asyncronously load the background image, if any
		BoardActions.getInstance().getBoardBackground(doc._id)
		.then(function(imageData) {
			Document.setBackground(imageData, false, boardBack);
			boardBack.css('display', 'block');
		})
		.catch(function(err) {
			if (err && (err.status == 404)) {
				return;
			}
			n.showAlert(err.message ? err.message : 'Error loading board background image: ' + doc.boardBackground, 'E', err.messageThreadId);
		})
		
		// Build board DOM structure first
		var containerHeight = $('#contentContainer').height() - 35;
		var mobileWidth = ($('#contentContainer').width() - 40);
		if (mobileWidth > 300) mobileWidth = 300;
		
		var lists = n.getData().getChildren(doc._id);
		Document.sortHierarchically(lists);
		
		var boardWidth = 0;		
		var itemElements = [];
		var itemHdrs = [];
		
		for(var l in lists) {
			if (lists[l]._id == doc.boardBackground) continue;
			
			// Column items
			var items = [];
			var subList = n.getData().getChildren(lists[l]._id);
			Document.sortHierarchically(subList);
			
			for(var i in subList) {
				if (subList[i]._id == doc.boardBackground) continue;
				
				// Colors for items
				var itemContent = $('<div class="board-item-content" data-id="' + subList[i]._id + '"></div>');
				Document.setItemBackground(subList[i], itemContent, subList[i].backColor ? subList[i].backColor : 'white');
				if (subList[i].color) itemContent.css('color', subList[i].color);
				
				var itemIconClass = this.getItemIconClass(subList[i]);
				
				var itemEl = $('<div class="board-item"></div>');
				var itemHdr = $('<div class="board-item-content-header"></div>')

				itemElements.push(itemEl);
				itemHdrs.push(itemHdr);
				
				var preview = (subList[i].preview ? subList[i].preview : '');
				
				items.push(
					itemEl.append(
						itemContent.append(
							itemHdr.append(
								!itemIconClass ? null : $('<div class="board-item-content-header-icon fa ' + itemIconClass + '"></div>'),
								$('<div class="board-item-content-header-text"></div>')
									.html(subList[i].name)
									
									// Right click on header of item
									.contextmenu(function(e) { 
										e.preventDefault();
							    		e.stopPropagation();
							    		
							    		that.saveScrollPosition();
							    		
							    		var data = $(e.currentTarget).parent().parent().data();

										Notes.getInstance().callOptions(
											[data.id], 
											Tools.extractX(e), 
											Tools.extractY(e),
											{
												showInNavigation: true
											}
										);
									}),
									
								Document.getLabelElements(subList[i], 'doc-label-board'),
								Document.getTagElements(subList[i], 'doc-hashtag-board')
							),
							
							$('<div class="board-item-content-preview">' + preview + '</div>')
							.each(function(i) {
								// Select
								this.selectEvent = new TouchClickHandler(this, {
									onGestureFinishCallback: function(event) {
										var data = $(event.currentTarget).parent().data();
										
										that.saveScrollPosition();
										
										if (Notes.getInstance().hideOptions()) return;										
										
										// Focus the document in navigation
										/*var d = Notes.getInstance().getData();
										var targetDoc = Document.getTargetDoc(d.getById(data.id));
										if (d.hasChildren(targetDoc._id)) {
											NoteTree.getInstance().open(targetDoc._id);											
										} else {
											NoteTree.getInstance().focus(targetDoc._id);
										}*/
										
										// Open the document
										Notes.getInstance().routing.call(data.id);
									},
									
									delayedHoldCallback: function(event) {
										var data = $(event.currentTarget).parent().data();

										Notes.getInstance().callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
									},
									delayHoldMillis: 600
								});
								
								// Right click on item itself
								$(this).contextmenu(function(e) {
									e.preventDefault();
						    		e.stopPropagation();

						    		that.saveScrollPosition();
						    		
						    		var data = $(e.currentTarget).parent().data();
						    		
									Notes.getInstance().callOptions(
										[data.id], 
										Tools.extractX(e), 
										Tools.extractY(e),
										{
											showInNavigation: true
										}
									);
								});
							})
						)
					)
				);
			}

			var isCollapsed = lists[l].boardState && lists[l].boardState.collapsed;
			var icon = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-right';
			
			// Colors for columns
			var colHdr;
			if (isCollapsed) {
				colHdr = $('<div class="board-column-collapsed"></div>').append(
					$('<div class="board-column-header-collapsed-content"></div>')
					.css('max-height', (containerHeight - 36) + 'px')
					.append(
						$('<div class="board-column-header-minimize-collapsed-icon fa ' + icon + '" data-id="' + lists[l]._id + '"></div>')
						.on('click', function(event) {
							var id = $(this).data().id;
							if (!id) return;
							
							that.toggleExpandedState(id);
						}),

						$('<div class="board-column-header-minimize-collapsed-headline"></div>')
						.html(lists[l].name),
						
						$('<span class="board-column-header-minimize-collapsed-headline-meta"></span>')
						.html(
							(subList.length == 0) ?
								'No Entries' :
								(subList.length + ((subList.length == 1) ? ' Entry' : ' Entries'))
						)
					)
				);
			} else {
				colHdr = $('<div class="board-column-header"></div>').append(
					$('<div class="board-column-header-content"></div>')
					.html(lists[l].name)
					.append(
						$('<div class="board-column-header-minimize-icon fa ' + icon + '" data-id="' + lists[l]._id + '"></div>')
						.on('click', function(event) {
							event.stopPropagation();
							
							var id = $(this).data().id;
							if (!id) return;
							
							that.toggleExpandedState(id);
						})
					)
					.each(function(i) {
						// Select
						this.selectEvent = new TouchClickHandler(this, {
							delayedHoldCallback: function(event) {
								var data = $(event.currentTarget).parent().parent().data();
								that.saveScrollPosition();
			
								var n = Notes.getInstance();
								
								// Do not show options when the item is inside a hidden board
								var doc = n.getData().getById(data.id);
								if (!doc || (doc.boardState && doc.boardState.collapsed)) return;
								
								n.callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
							},
							delayHoldMillis: 600,
							dontStopPropagation: true
						});
						
						// Right click
						$(this).contextmenu(function(e) {
							e.preventDefault();
			        		e.stopPropagation();
			        		
			        		that.saveScrollPosition();
			        		
			        		var data = $(e.currentTarget).parent().parent().data();
			
		        			Notes.getInstance().callOptions(
		        				[data.id], 
		        				Tools.extractX(e), 
		        				Tools.extractY(e),
								{
									showInNavigation: true
								} 
		        			);
						});
					})	
				);
			}
			
			// Colors for list headers
			Document.setItemBackground(lists[l], colHdr, lists[l].backColor ? lists[l].backColor : 'black');
			if (lists[l].color) colHdr.css('color', lists[l].color);
			
			var itemWidth;
			if (isCollapsed) itemWidth = 50;
			else itemWidth = n.isMobile() ? mobileWidth : 300;  // TODO make last one adjustable
			boardWidth += itemWidth + 10;
			
			var boardCol = $('<div class="board-column" data-id="' + lists[l]._id + '"></div>');
			
			// Columns
			boardContainer.append(
				boardCol
				.css('width', itemWidth + 'px') 
				.css('max-height', containerHeight + 'px')
				.append(
					$('<div class="board-column-container" data-id="' + lists[l]._id + '"></div>')
					.css('max-height', containerHeight + 'px')
					.append([
						colHdr,
						isCollapsed ? null : $('<div class="board-content-wrapper" data-id="' + lists[l]._id + '"></div>')
						.css('max-height', (containerHeight - 50) + 'px')
						.append(
							$('<div class="board-column-content" data-id="' + lists[l]._id + '"></div>')
							.contextmenu(function(event) {
								event.stopPropagation();
								event.preventDefault();
								
								var data = $(event.currentTarget).parent().parent().data();
								
								n.callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
							})
							.append(items)
						)
					])
				)
				.contextmenu(function(e) {
					// Kills the right click on column backgrounds
					e.stopPropagation();
					e.preventDefault();
				})
			);
			
			// Drop files into the list
			Tools.dropFilesInto([
				{
					elements: boardCol,
					callback: function(files, definition, element) {
						var id = $(element).data().id;
						var lst = n.getData().getById(id);
						if (!lst) {
							return;
						}
						
						console.log("Dropped " + files.length + " files into " + lst.name);
						
						AttachmentActions.getInstance().uploadAttachments(id, files)
						.catch(function(err) {
							Notes.getInstance().showAlert(err.message ? err.message : 'Error uploading files', err.abort ? 'I' : 'E', err.messageThreadId);
						});
					}
				}
			]);

			//this.updateExpandedState(lists[l]._id);
		}

		// Set container size so that only horizontal layouting takes place (the horizontal option of Muuri seems not to work properly)
		$('.board-container').css('min-width', (boardWidth + 10) + "px");

		// Labels size
		var labels = $('.doc-label');
		labels.css('min-width', "16px");
		labels.css('max-width', "16px");
		labels.css('min-height', "16px");
		labels.css('max-height', "16px");
		
		var tags = $('.doc-hashtag');
		tags.css('min-width', "16px");
		tags.css('max-width', "16px");
		tags.css('min-height', "16px");
		tags.css('max-height', "16px");
		
		// Item height in general
		if (itemElements.length != itemHdrs.length) throw new Error('Internal error creating Board: item element mismatch');
		for(var i in itemElements) {
			itemElements[i].height((itemHdrs[i].height() + 60) + 'px');
		}
		
		// Initialize the column grids so we can drag those items around.
		var itemContainers = boardContainer.find('.board-column-content');
		this.columnGrids = [];

		itemContainers.each(function (i) {
			var colId = $(itemContainers[i]).data().id;
			var grid = new Muuri(itemContainers[i], {
				items: '.board-item',
				dragEnabled: true,
				dragSort: function () {
					return that.columnGrids;
				},
				dragHandle: '.board-item-content-header-text',
				dragContainer: dragContainer[0],
				dragStartPredicate: {
					distance: 0,
					delay: Notes.getInstance().isMobile() ? 200 : 0,  // Prevents false item moves on mobiles
				},
				dragAutoScroll: {
					targets: (item) => {
						return [
							{ 
								element: $('.board-content-wrapper[data-id=' + colId + ']')[0],
								priority: 0 
							},
							{ 
								element: $('#board-scroll-container')[0],
								priority: 1 
							},
						];
					},
					threshold: 50,
					safeZone: 0.6,
				},
				
				layout: {},
				
				containerClass: 'cmuuri',
				itemClass: 'cmuuri-item',
				itemVisibleClass: 'cmuuri-item-shown',
				itemHiddenClass: 'cmuuri-item-hidden',
				itemPositioningClass: 'cmuuri-item-positioning',
				itemDraggingClass: 'cmuuri-item-dragging',
				itemReleasingClass: 'cmuuri-item-releasing',
				itemPlaceholderClass: 'cmuuri-item-placeholder'
			})
			.on('dragInit', function (item) {
				item.oldWidth = item.getElement().style.width;
				item.oldHeight = item.getElement().style.height;
				item.getElement().style.width = item.getWidth() + 'px';
				item.getElement().style.height = item.getHeight() + 'px';
				Notes.getInstance().hideOptions();
			})
			.on('dragReleaseEnd', function (item) {
				item.getElement().style.width = item.oldWidth;
				item.getElement().style.height = item.oldHeight;
				item.getGrid().refreshItems([item]);
				
				that.saveOrder(item);
			})
			.on('layoutStart', function () {
				if (that.boardGrid) that.boardGrid.refreshItems().layout();
			});

			that.columnGrids.push(grid);
		});

		// Initialize board grid so we can drag those columns around.
		this.boardGrid = new Muuri(boardContainer[0], {
			dragEnabled: true,
			dragHandle: '.board-column-header',
			dragStartPredicate: {
				distance: 50,
				delay: Notes.getInstance().isMobile() ? 200 : 0,  // Prevents false item moves on mobiles
			},
			dragAutoScroll: {
				targets: (item) => {
					return [
						{ 
							element: $('#board-scroll-container')[0],
							priority: 1 
						},
					];
				},
				threshold: 50,
				safeZone: 0.6,
			},
			
			containerClass: 'bmuuri',
			itemClass: 'bmuuri-item',
			itemVisibleClass: 'bmuuri-item-shown',
			itemHiddenClass: 'bmuuri-item-hidden',
			itemPositioningClass: 'bmuuri-item-positioning',
			itemDraggingClass: 'bmuuri-item-dragging',
			itemReleasingClass: 'bmuuri-item-releasing',
			itemPlaceholderClass: 'bmuuri-item-placeholder'
		})
		.on('dragInit', function (item) {
			Notes.getInstance().hideOptions();
		})
		.on('dragReleaseEnd', function (item) {
			that.saveOrder(item);
		});
		
		// Height of the preview element (must be set here because of CSS rendering bugs in iOS webkit)		
		$('.board-item-content-preview').each(function(i) {
			var itemContent = $(this).parent();
			var soll = itemContent.offset().top + itemContent.height();
			var ist = $(this).offset().top + $(this).height();
			var diff = ist - soll;
			if (diff != 0) {
				var previewHeight = $(this).height() - diff; 
				$(this).css('height', previewHeight);		
			}
		});
	}
	
	/**
	 * Refresh board
	 */
	refresh() {
		if (this.current) this.load(this.current);
	}
	
	/**
	 * Toggle the expanded state of the passed document ID
	 */
	toggleExpandedState(id) {
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return;
		
		if (!doc.boardState) doc.boardState = {};

		// Toggle
		doc.boardState.collapsed = !doc.boardState.collapsed;
		
		// Update
		this.refresh();
		
		// Save state on DB
		BoardActions.getInstance().saveBoardState(id, doc.boardState)
		/*.then(function(data) {
			n.showAlert(data.message ? data.message : 'Saved list state', 'S');
		})*/
		.catch(function(err) {
			n.showAlert(err.message ? err.message : 'Error saving list state', 'E', err.messageThreadId);
		});
	}

	/**
	 * Returns the fa class for the item icon, or falsy if no icon should be shown.
	 */
	getItemIconClass(doc) {
		if (doc.type == 'attachment') return 'fa-paperclip';
		if (doc.type == 'reference') return 'fa-long-arrow-alt-right';
		if (doc.type == 'note' && doc.editor == 'board') return 'fa-border-all'; 
		if (Notes.getInstance().getData().hasChildren(doc._id)) return 'fa-plus';

		return null;
	}
	
	/**
	 * Refreshes all appearance attributes of the ID
	 */
	refreshColors(id) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(id);
		if (!doc) return;
		
		if (doc.parent == this.getCurrentId()) {
			// Columns
			var colCont = $('.board-column-container[data-id=' + id + ']');
			if (!colCont) return;
			
			var colHdr;
			if (doc.boardState && doc.boardState.collapsed) {
				colHdr = colCont.find('.board-column-collapsed');
			} else {
				colHdr = colCont.find('.board-column-header');
			}
			if (!colHdr) return;
			
			if (doc.backColor) colHdr.css('background-color', doc.backColor);
			if (doc.color) colHdr.css('color', doc.color);
		} else {
			// Items
			var itemContent = $('.board-item-content[data-id=' + id + ']');
			if (!itemContent) return;
			
			if (doc.backColor) itemContent.css('background-color', doc.backColor);
			if (doc.color) itemContent.css('color', doc.color);
		}
	}
	
	/**
	 * Kill the grids
	 */
	destroy() {
		if (this.boardGrid) {
			this.boardGrid.destroy();
		}
		
		for(var i in this.columnGrids || []) {
			this.columnGrids[i].destroy();
		}
	}
	
	/**
	 * Re-layout the grids
	 */
	layout() {
		if (this.boardGrid) this.boardGrid.layout();
	
		for(var i in this.columnGrids || []) {
			this.columnGrids[i].layout();
		}
	}
	
	/**
	 * Scans all items and saves the ones that have changed parent or order
	 */
	saveOrder(movedItem) {
		if (!this.boardGrid) return;
		if (!this.columnGrids) return;
		
		this.saveScrollPosition();
		
		if (Notes.getInstance().optionsVisible()) return;
		
		var ids = [];
		var d = Notes.getInstance().getData();
		
		// Column orders
		var no = 1;
		var cItems = this.boardGrid.getItems();
		for(var i in cItems) {
			var iid = $(cItems[i].getElement()).find('.board-column-container').data().id;
			if (!iid) continue;
			
			var doc = d.getById(iid);
			if (!doc) continue;
			
			var newOrder = no++;
			var oldOrder = Document.getRelatedOrder(doc);
			if (oldOrder != newOrder) {
				/*Document.addChangeLogEntry(doc, 'orderChanged', {
					from: oldOrder,
					to: newOrder
				});*/
				
				Document.setRelatedOrder(doc, false, newOrder);
				ids.push(iid);
			}
		}
		
		// Item orders and parents
		for(var c in this.columnGrids || []) {
			var colId = $(this.columnGrids[c].getElement()).data().id;
			
			no = 1;
			var iItems = this.columnGrids[c].getItems();
			for(var i in iItems) {
				var iid = $(iItems[i].getElement()).find('.board-item-content').data().id;
				if (!iid) continue;
				
				var doc = d.getById(iid);
				if (!doc) continue;
				
				var newOrder = no++;
				var oldOrder = Document.getRelatedOrder(doc);
				var push = false;
				if (oldOrder != newOrder) {
					/*Document.addChangeLogEntry(doc, 'orderChanged', {
						from: oldOrder,
						to: newOrder
					});*/
					
					Document.setRelatedOrder(doc, false, newOrder);
					push = true;
				}
				if (doc.parent != colId) {
					/*Document.addChangeLogEntry(doc, 'parentChanged', {
						from: doc.parent,
						to: colId
					});*/
					
					d.setParent(iid, colId);
					push = true;
				}
				
				if (push) ids.push(iid);
			}
		}
		
		if (ids.length == 0) return;

		NoteTree.getInstance().destroy();
		NoteTree.getInstance().init(true);

		DocumentAccess.getInstance().saveItems(ids)
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
		});
	}
	
	/**
	 * Returns the scroll container (which is carrying the scroll position)
	 */
	getScrollContainer() {
		return $('#board-scroll-container'); 
	}
	
	/**
	 * Returns the current scroll position
	 */
	getScrollPosition() {
		var scrollContainer = this.getScrollContainer();
		
		return {
			scrollX: scrollContainer.scrollLeft(),
			scrollY: scrollContainer.scrollTop()
		};
	}
	
	/**
	 * Saves the current scroll position.
	 */
	saveScrollPosition() {
		ClientState.getInstance().saveBoardState(this.getScrollPosition());
	}
	
	/**
	 * Restore the last saved scroll position
	 */
	restoreScrollPosition() {
		var state = ClientState.getInstance().getBoardState();
		
		var scrollContainer = this.getScrollContainer();
		if (state.scrollX) scrollContainer.scrollLeft(state.scrollX);
		if (state.scrollY) scrollContainer.scrollTop(state.scrollY);
	}
	
	/**
	 * Remembers the currently loaded note data in this.current. Also adjusts the loaded note text etc.
	 */
	setCurrent(doc) {
		this.current = doc;

		var n = Notes.getInstance();
		
		var txt = "";
		if (doc) txt = doc.name + (n.isMobile() ? "" : " (" + new Date(doc.timestamp).toLocaleString() + ")");

		// Show loaded note in the header bar 
		//var that = this;
		n.setStatusText(txt/*, function(event) {
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
		}*/ );
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
		
		this.saveScrollPosition();
		
		n.showMenu('editorOptions', function(cont) {
			cont.append(
				// Background image
				$('<div class="userbutton"><div class="fa fa-image userbuttonIcon"></div>Background Image</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.hideOptions();
					
					BoardActions.getInstance().setBoardBackgroundImage(that.getCurrentId())
					.then(function(/*data*/) {
						n.routing.call(that.getCurrentId());
					})
					.catch(function(err) {
						Notes.getInstance().showAlert(err.message ? err.message : 'Error setting background image', err.abort ? 'I' : "E", err.messageThreadId);
					});
				}),	
			);
			
			cont.append(
				PageMenu.get(that)
			);
		});
	}
	
	getType() {
		return 'note';
	}

	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'board';
	}
	
	/**
	 * Hides all option menus for the editor
	 */
	hideOptions() {
		Notes.getInstance().hideMenu();
		Notes.getInstance().hideOptions();
	}
	
	/**
	 * Return current HTML content of the editor.
	 */
	getContent() {
		return this.current ? Docment.getContent(this.current) : ""; 
	}
	
	/**
	 * Unloads the editor
	 */
	unload() {
		Notes.getInstance().registerOptionsCallbacks({
			id: 'board'
		});
		Callbacks.getInstance().deleteCallbacks('board');
				
		this.setCurrent();
		this.resetDirtyState();
		this.destroy();
		
		var n = Notes.getInstance();
		
		n.update();
	}
	
	/**
	 * Returns the dirty state of the editor
	 */
	isDirty() {
		return false;
	}

	/**
	 * Set the editor dirty
	 */
	setDirty() {
	}
	
	/**
	 * Refresh editor dirty state
	 */
	resetDirtyState() {
	}
	
	/**
	 * Stop delayed save
	 */
	stopDelayedSave() {
	}
	
	/**
	 * Check basic property correctness
	 */
	static checkBasicProps(doc, errors) {
		if (doc.boardBackground) {  // This is relevant for all documents!
			errors.push({
				message: 'Document contains deprecated boardBackground reference',
				id: doc._id,
				type: 'W',
				solverReceipt: [{
					action: 'deleteProperty',
					propertyName: 'boardBackground'
				}]
			});		
		}
	}
}
	