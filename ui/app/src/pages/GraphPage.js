/**
 * Graph view
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
class GraphPage extends Page {
	
	#graph = null;  
	
	/**
	 * Can be used to signal that the page also needs all navigation data loaded.
	 */
	needsHierarchyData() {
		return true;
	}
	
	static experimentalFunctionId = 'GraphPage';     // #IGNORE static 
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	async load() {
		this._tab.setStatusText("Graph view");
		
		var infoElement = $('<span class="graphInfoPanel"></span>');
		var graphContainer = $('<span class="graphContainer"></span>');
		this._tab.getContainer().append(
			graphContainer,
			infoElement
		);

		this.#graph = new Graph(this._app, graphContainer, infoElement);

		this.#initGraph();
	}
	
	/**
	 * Stop animation
	 */
	async unload() {
		if (this.#graph) this.#graph.stop();
	}

	/**
	 * Creates the initial graph.
	 */	
	#initGraph() {
		var d = this._app.data;
		
		var docs = [];
		d.each(function(doc) {
			docs.push(doc);
		});
		
		if (docs.length > 1000) {
			if (!confirm('The graph will contain ' + docs.length + ' documents, this migh be slow. Continue?')) {
				return;
			}
		}
			
		this.#graph.addDocuments(docs);
	}
}