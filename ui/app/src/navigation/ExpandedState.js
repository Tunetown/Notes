/**
 * Handler for navigation behaviours using expanded state
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
class ExpandedState {
	
	#app = null;
	
	constructor(app, behaviour) {
		this.#app = app;
		
		this.behaviour = behaviour;
		this.expanded = [];
	}
	
	/**
	 * Returns an note ID array list of all expanded nodes.
	 */
	getExpanded() {
		return this.expanded;
	}
	
	/**
	 * Restore expanded state by the passed array of expanded document IDs.
	 */
	restoreTreeState(expanded) {
		if (!expanded) {
			this.expanded = [];
			return;
		}
		
		for(var i in expanded) {
			this.expandById(expanded[i]);
		}
	}
	
	/**
	 * Expands all parents of the id
	 */
	expandPathTo(doc, noFilter) {
		if (!doc) return;
		
		if (doc.parentDoc) {
			this.expandPathTo(doc.parentDoc, true);
		}
		
		if (!this.isExpanded(doc._id)) {
			this.expandById(doc._id, true);
		}

		if (!noFilter && this.behaviour.grid.grid) this.behaviour.grid.filter(!this.behaviour.animateOnExpandedStateChange());
	}
	
	/**
	 * Expands the node of the given note ID. Returns if found.
	 */
	expandById(id, noFilter) {
		if (this.isExpanded(id)) return;
		
		this.expanded.push(id);

		this.#app.state.saveTreeState();
		
		this.behaviour.beforeExpand(id, noFilter);
		
		if (!noFilter && this.behaviour.grid.grid) {
			this.behaviour.grid.filter(!this.behaviour.animateOnExpandedStateChange());
		}
		
		this.behaviour.afterExpand(id, noFilter);
	}
	
	/**
	 * Collapse the passed ID
	 */
	collapseById(id, noFilter) {
		if (!this.behaviour.grid) return;
		
		if (!this.isExpanded(id)) return;
		
		var i = this.expanded.indexOf(id);
		this.expanded.splice(i, 1);

		this.#app.state.saveTreeState();
		
		this.behaviour.beforeCollapse(id, noFilter);
		
		if (!noFilter && this.behaviour.grid.grid) {
			this.behaviour.grid.filter(!this.behaviour.animateOnExpandedStateChange());
		}
		
		this.behaviour.afterCollapse(id, noFilter);
	}
	
	/**
	 * Returns if the passed ID is expanded
	 */
	isExpanded(id) {
		return this.expanded.indexOf(id) >= 0;
	}
}