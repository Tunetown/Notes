/**
 * Generic History Handler, works with all types of items.
 * 
 * (C) Thomas Weber 2022 tom-vibrant@gmx.de
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
class HistoryHandler {
	
	constructor() {
		this.init();
	}
	
	/**
	 * Add a new item after the current position, and increase the position to the new item's index.
	 * Returns nothing.
	 */
	add(item) {
		this.history = [
			...this.history.slice(0, ++this.position),
			item,
		];
	}
	
	/**
	 * Go back, and return the now current item. If not possible, returns null.
	 */
	back() {
		if (!this.canBack()) return null;
		--this.position;
		
		return this.get();
	}
	
	/**
	 * Go forward, and return the now current item. If not possible, returns null.
	 */
	forward() {
		if (!this.canForward()) return null;
		++this.position;
		
		return this.get();
	}

	/**
	 * Returns if the history can go back.
	 */	
	canBack() {
		return (this.position > 0);
	}

	/**
	 * Returns if the history can go forward.
	 */	
	canForward() {
		return (this.position < this.history.length - 1);
	}

	/**
	 * Reset the history. Returns nothing.
	 */
	init() {
		this.history = [];
		this.position = -1;
	}
	
	/**
	 * Returns the item at the current position, or null if the history is empty.
	 */
	get() {
		return this.at(this.position);
	}

	/**
	 * Returns the item at the given position, or null if out of bounds.
	 */
	at(index) {
		if (index < 0) return null;
		if (index >= this.history.length) return null;
		return this.history[index];
	}
}
	