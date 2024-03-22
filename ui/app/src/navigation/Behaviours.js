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
	
	static modeIdDetailRef = 'detail-ref';   // #IGNORE static
	static modeIdTree = 'tree';              // #IGNORE static
	
	/**
	 * Returns a mode selector.
	 */
	static getModeSelector(id, selectedMode) {  // #IGNORE static
		return $('<select id="' + id + '"></select>').append(
			$('<option value="' + Behaviours.modeIdDetailRef + '">References</option>').prop('selected', Behaviours.modeIdDetailRef == selectedMode),
			$('<option value="' + Behaviours.modeIdTree + '">Tree</option>').prop('selected', Behaviours.modeIdTree == selectedMode),
		);
	}
	
	/**
	 * Factory for behaviours
	 */
	static get(app, mode, grid) {  // #IGNORE static
		switch (mode) {
			case Behaviours.modeIdDetailRef: return new DetailBehaviour(app, grid, true);
			case Behaviours.modeIdTree: return new TreeBehaviour(app, grid);
			default: return new DetailBehaviour(app, grid, true);
		} 
	}
}