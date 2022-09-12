/**
 * Handler for navigation behaviours using scroll state
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
class ScrollState {
	
	constructor(containerElementId, appId) {
		this.containerElementId = containerElementId;
		this.appId = appId;
	}
	
	/**
	 * Saves the current scroll position. Optionally, if the passed document ID
	 * is set, the positions will be stored for each document individually.
	 */
	savePosition(docId) {
		if (!docId) {
			docId = 'all';
		}
		
		var state = ClientState.getInstance().getScrollState();
		if (!state.hasOwnProperty(this.appId)) {
			state[this.appId] = {};
		}

		state[this.appId][docId] = this.getPosition();
		
		ClientState.getInstance().saveScrollState(state);
	}
	
	/**
	 * Restore the last saved scroll position. Optionally, if the passed document ID
	 * is set, the positions will be stored for each document individually.
	 */
	restorePosition(docId) {
		if (!docId) {
			docId = 'all';
		}
		
		var state = ClientState.getInstance().getScrollState();
		
		if (!state || !state.hasOwnProperty(this.appId)) return;
		
		var pos = state[this.appId][docId];
		if (!pos) return;

		var c = this.getContainer();
		/*if (pos.scrollX)*/ c.scrollLeft(pos.scrollX);
		/*if (pos.scrollY)*/ c.scrollTop(pos.scrollY);
	}
	
	/**
	 * Reset scroll position to zero. Optionally, if the passed document ID
	 * is set, the positions will be stored for each document individually.
	 */
	resetPosition(docId) {
		var c = this.getContainer();
		c.scrollLeft(0);
		c.scrollTop(0);
		
		this.savePosition(docId);
	}
	
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns the scroll container
	 */
	getContainer() {
		return $('#' + this.containerElementId);
	}
	
	/**
	 * Returns the current scroll position
	 */
	getPosition() {
		var c = this.getContainer();
		return {
			scrollX: c.scrollLeft(),
			scrollY: c.scrollTop()
		};
	}
}