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
	 *
	static getNextNavMode() {
		var cs = ClientState.getInstance().getViewSettings();
		switch (cs.navMode) {
		//case 'tiles': return 'detail';
		case 'detail': return 'tree';
		case 'tree': return 'detail'; //'tiles';   // NOTE: Tile navigation is disabled here. 
		} 
		return null;
	}
	
	/**
	 * Returns the FA icon class postfix for the given nav mode
	 *
	static getNavModeIcon(mode) {
		switch (mode) {
		case 'tiles': return 'th-large';
		case 'detail': return 'list';
		case 'tree': return 'tree';
		} 
		return null;
	}
	
	/**
	 * Sets the correct icon class active on the element for the passed mode
	 *
	static setNavModeIconClass(el, mode) {
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('tiles'), mode == 'tiles');
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('detail'), mode == 'detail');
		el.toggleClass('fa-' + Behaviours.getNavModeIcon('tree'), mode == 'tree');
	}*/
	
	static modeIdDetailRef = 'detail-ref';
	static modeIdDetailHierarchical = 'detail-hier';
	static modeIdTiles = 'tiles';
	static modeIdTree = 'tree';
	
	/**
	 * Returns a mode selector.
	 */
	static getModeSelector(id, selectedMode) {
		return $('<select id="' + id + '"></select>').append(
			$('<option value="' + Behaviours.modeIdDetailRef + '">References</option>').prop('selected', Behaviours.modeIdDetailRef == selectedMode),
			$('<option value="' + Behaviours.modeIdDetailHierarchical + '">Hierarchical</option>').prop('selected', Behaviours.modeIdDetailHierarchical == selectedMode),
			$('<option value="' + Behaviours.modeIdTree + '">Tree</option>').prop('selected', Behaviours.modeIdTree == selectedMode),
		);
	}
	
	/**
	 * Factory for behaviours
	 */
	static get(mode, grid) {
		switch (mode) {
		case Behaviours.modeIdTiles: return new TileBehaviour(grid);
		case Behaviours.modeIdDetailRef: return new DetailBehaviour(grid, true);
		case Behaviours.modeIdDetailHierarchical: return new DetailBehaviour(grid);
		case Behaviours.modeIdTree: return new TreeBehaviour(grid);
		default: return new DetailBehaviour(grid, true);
		} 
		return null;
	}
}