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
class GraphView {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!GraphView.instance) GraphView.instance = new GraphView();
		return GraphView.instance;
	}
	
	static experimentalFunctionId = 'GraphPage';
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	load() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		n.setStatusText("Graph view");
		
		$('#contentContainer').empty();
		
		var infoElement = $('<span id="graphInfoPanel"></span>');
		$('#contentContainer').append(
			$('<span id="graphContainer"></span>'),
			infoElement
		);
		/*var canvas = $('<canvas class="graphCanvas" width="' + $('#contentContainer').width() + '" + height="' + $('#contentContainer').height() + '"></canvas>');
		$('#contentContainer').append(
			canvas
		);*/

		this.graph = new Graph(this.#app, 'graphContainer', infoElement);

		this.initGraph();
		
		// Buttons
		/*n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Back to standard editor" class="fa fa-times" onclick="event.stopPropagation();RawView.getInstance().back()"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Save" class="fa fa-save" onclick="event.stopPropagation();RawView.getInstance().save()"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Export including children..." class="fa fa-file-export" onclick="event.stopPropagation();RawView.getInstance().exportCompletely()"></div>') 
		]);	*/
	}
	
	/**
	 * Stop animation
	 */
	unload() {
		if (this.graph) this.graph.stop();
	}

	/**
	 * Creates the initial graph.
	 */	
	initGraph() {
		var d = Notes.getInstance().getData();
		
		var docs = [];
		d.each(function(doc) {
			docs.push(doc);
		});
		
		if (docs.length > 1000) {
			if (!confirm('The graph will contain ' + docs.length + ' documents, this migh be slow. Continue?')) {
				return;
			}
		}
			
		this.graph.addDocuments(docs);
	}
}