/**
 * Behaviours factory and tools
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
class Behaviours {
	/**
	 * Gets the next nav mode proposed
	 */
	static getNextNavMode() {
		var cs = ClientState.getInstance().getViewSettings();
		switch (cs.navMode) {
		//case 'tiles': return 'detail';
		case 'detail': return 'reference';
		case 'reference': return 'tree';
		case 'tree': return 'detail'; //'tiles';   // NOTE: Tile navigation is disabled here. 
		} 
		return null;
	}
	
	/**
	 * Returns the FA icon class postfix for the given nav mode
	 */
	static getNavModeIcon(mode) {
		switch (mode) {
		case 'reference': return 'project-diagram';
		case 'tiles': return 'th-large';
		case 'detail': return 'list';
		case 'tree': return 'tree';
		} 
		return null;
	}
	
	/**
	 * Sets the correct icon class active on the element for the passed mode
	 */
	static setNavModeIconClass(el, mode) {
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('reference'), mode == 'reference');
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('tiles'), mode == 'tiles');
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('detail'), mode == 'detail');
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('tree'), mode == 'tree');
	}
	
	/**
	 * Factory for behaviours
	 */
	static get(mode, grid) {
		switch (mode) {
		case 'reference': return new ReferenceBehaviour(grid);
		case 'tiles': return new TileBehaviour(grid);
		case 'detail': return new DetailBehaviour(grid);
		case 'tree': return new TreeBehaviour(grid);
		} 
		return null;
	}
}