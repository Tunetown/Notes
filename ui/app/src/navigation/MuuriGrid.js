/**
 * Handler for a tree based on Muuri Grids.
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
class MuuriGrid {

	constructor(el, options) {
		this.options = options;
    	
		this.grid = null;
    	this.dropIntoTarget = null;
    	this.dropBeneathTarget = null;
    	
    	this.init(el);
	}
	
	/**
	 * Destroy the Muuri grid instance
	 */
	destroy() {
		if (!this.grid) return;
		this.grid.destroy();
	}
	
	/**
	 * Initialize the grid on the passed element.
	 */
	init(el) {
		var that = this;
	
		var settings = Settings.getInstance().settings;
	
		this.grid = new Muuri(el, {
			showDuration: 100,
			showEasing: 'ease',
			hideDuration: 100,
			hideEasing: 'ease',
			dragEnabled: true,
			dragHandle: this.options.dragHandle,
			layoutOnInit: false,
			layoutOnResize: 100,
		    layoutDuration: (!!settings.navigationAnimationDuration) ? settings.navigationAnimationDuration : 50,
			layoutEasing: 'ease',
			layout: this.options.layoutCallback,
			 
			dragAutoScroll: this.options.autoScrollTargets,
			
			sortData: this.options.sortData, 
				
			dragSortPredicate: function(item, event) {
				return that.sortPredicate(item, event);
			},
			
			dragStartPredicate: {
				delay: this.options.dragDelayMillis,
			},

		})
		.on('move', function () {
		})
		.on('dragInit', function (item, event) {
			that.dropIntoTarget = null;
			that.dropBeneathTarget = null;
			
			if (that.options.dragInitCallback) {
				that.options.dragInitCallback(item, event);
			}
			
		})
		.on('dragReleaseStart', function (item) {
			if (that.dropIntoTarget) {
				if (that.options.dropIntoCallback) {
					if (that.options.enableDropCallback) {
						if (that.options.enableDropCallback(item, that.dropIntoTarget, true)) {
							that.options.dropIntoCallback(item, that.dropIntoTarget);
							
							$(that.dropIntoTarget._element).find('.' + that.options.contentClass).removeClass(that.options.moveIntoClass);
							return;
						}
					} else {
						that.options.dropIntoCallback(item, that.dropIntoTarget);
						
						$(that.dropIntoTarget._element).find('.' + that.options.contentClass).removeClass(that.options.moveIntoClass);
						return;
					}
				}
			} 

			if (that.dropBeneathTarget) {
				if (that.options.dropBeneathCallback) {
					if (that.options.enableDropCallback) {
						if (that.options.enableDropCallback(item, that.dropBeneathTarget, false)) {
							that.options.dropBeneathCallback(item, that.dropBeneathTarget);
							return;
						}
					} else {
						that.options.dropBeneathCallback(item, that.dropBeneathTarget);
						return;
					}
				}
			}
			
		})
		.on('layoutStart', function (items) {
		})
		.on('layoutEnd', function (items) {
			if (that.options.onFinishCallback) that.options.onFinishCallback(items);
		});

		this.grid.layout(true);
	}
	
	/**
	 * Enable dragging for the passed Muuri item
	 */
	itemEnableDrag(item) {
		if (item._drag) return;
		item._drag = new Muuri.ItemDrag(item);
	}
	
	/**
	 * Disable dragging for the passed Muuri item
	 */
	itemDisableDrag(item) {
		 if (!item._drag) return;
		 item._drag.destroy();
		 item._drag = null;
	}
	
	/**
	 * Refresh the layout.
	 */
	refresh(callback) {
		this.grid.layout(true, callback);
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Custom handler to allow moving items inside other items
	 */
	sortPredicate(item, event) {
		var itemRect = {};
		var targetRect = {};
		var returnData = {};

		var drag = item._drag;
		var grid = drag._getGrid();

		// Populate item rect data.
		itemRect.width = item._width;
		itemRect.height = item._height;

		var matchScore = 0;
		var matchIndex = -1;
		var matchTarget = null;
		var matchMouseover = false;
		var hasValidTargets = false;
		var target;
		var score;

		itemRect.left = drag._gridX + item._marginLeft;
		itemRect.top = drag._gridY + item._marginTop;

		// Loop through the target grid items and try to find the best match.
		//for (var i = 0; i < grid._items.length; i++) {
		for(var i in grid._items) {
			target = grid._items[i];

			// If the target item is not active or the target item is the dragged
			// item let's skip to the next item.
			if (!target._isActive || target === item) {
				continue;
			}
	        
			$(target._element).find('.' + this.options.contentClass).removeClass(this.options.moveIntoClass);

			// Mark the grid as having valid target items.
			hasValidTargets = true;

			// Calculate the target's overlap score with the dragged item.
			targetRect.width = target._width;
			targetRect.height = target._height;
			targetRect.left = target._left + target._marginLeft; 
			targetRect.top = target._top + target._marginTop;
			score = this.getIntersectionScore(itemRect, targetRect);

			// Update best match index and score if the target's overlap score with
			// the dragged item is higher than the current best match score.
			if (score > matchScore) {
				matchIndex = i;
				matchScore = score;
				matchTarget = target;
			}

			if (this.rectContains(targetRect, Tools.extractX(event) - grid._left, Tools.extractY(event) - grid._top)) {
				matchIndex = i;
				matchMouseover = true;
				matchTarget = target;
			}
		}

		this.dropIntoTarget = null; 
		
		// Check if the best match overlaps enough to justify a placement switch.
		if ((this.options.scoreMatchingThreshold >= 0) && (matchScore >= this.options.scoreMatchingThreshold)) {
			returnData.index = parseInt(matchIndex);
			returnData.action = 'move';
			
			this.dropBeneathTarget = matchTarget;

			if (this.options.enableDropCallback) {
				return this.options.enableDropCallback(item, matchTarget, false) ? returnData : null;
			} else {
				return returnData;
			}
		}
		
		// Move into node
		if (matchMouseover && this.options.dropIntoCallback) {
			$(matchTarget._element).find('.' + this.options.contentClass).addClass(this.options.moveIntoClass);
			
			this.dropIntoTarget = matchTarget;
			return null;
		}
		
		return null;
	}
	
	/**
	 * Returns if the x/y point is contained in the passed rectangle.
	 */
	rectContains(rect, x, y) {
		if (y < rect.top) return false;
		if (y > rect.top + rect.height) return false;
		if (x < rect.left) return false;
		if (x > rect.left + rect.width) return false;
		return true;
	}
	
	/**
	 * Check if two rectangles are overlapping.
	 *
	 * @param {Object} a
	 * @param {Object} b
	 * @returns {Number}
	 */
	isOverlapping(a, b) {
		return !(
			a.left + a.width <= b.left ||
			b.left + b.width <= a.left ||
			a.top + a.height <= b.top ||
			b.top + b.height <= a.top
		);
	}

	/**
	 * Calculate intersection area between two rectangle.
	 *
	 * @param {Object} a
	 * @param {Object} b
	 * @returns {Number}
	 */
	getIntersectionArea(a, b) {
		if (!this.isOverlapping(a, b)) return 0;
		var width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
		var height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
		return width * height;
	}

	/**
	 * Calculate how many percent the intersection area of two rectangles is from
	 * the maximum potential intersection area between the rectangles.
	 *
	 * @param {Object} a
	 * @param {Object} b
	 * @returns {Number}
	 */
	getIntersectionScore(a, b) {
		var area = this.getIntersectionArea(a, b);
		if (!area) return 0;
		var maxArea = Math.min(a.width, b.width) * Math.min(a.height, b.height);
		return (area / maxArea) * 100;
	}
}