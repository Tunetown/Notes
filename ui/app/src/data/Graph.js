/**
 * Graph implementation.
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
class Graph {
	
	/**
	 * Expects a container element (non-jquery, standard DOM element) to render the graph into.
	 */
	constructor(containerId, infoPanel) {
		var that = this;

		this.nextNodeId = 1;
		this.nextEdgeId = 1;
		
		// Helper map to get the numerical node IDs for the documents
		this.nodeIds = new Map();
	
		this.infoPanel = infoPanel;
		$('#' + containerId).mousemove(function(e) {
			that.infoPanel.css('left', (e.offsetX + 20) + 'px');
			that.infoPanel.css('top', (e.offsetY + 20) + 'px');
		});
	
		this.defaultNodeRadius = 7;
	
		// Graph
		this.graph = new Neo4jd3('#' + containerId, {
			minCollision: 15,
			neo4jData: { results: [] },
			nodeRadius: this.defaultNodeRadius,
			zoomFit: false,
			infoPanel: false,
			onNodeDoubleClick: function(node) {
				Notes.getInstance().routing.call(node.properties.docId);
			},
			onNodeMouseEnter: function(node) {
				that.infoPanel.css('display', 'block');	
				
				var doc = Notes.getInstance().getData().getById(node.properties.docId);
				if (doc) {
					that.infoPanel.css('background-color', doc.backColor ? doc.backColor : 'white');
					that.infoPanel.css('color', doc.color ? doc.color : 'black');
					that.infoPanel.html(doc.name);		
				}
			},
			onNodeMouseLeave: function(node) {
				that.infoPanel.css('display', 'none');			
			},
			onNodeClick: function(node) {
				// Release sticky node
				ClientState.getInstance().saveGraphMeta(node.properties.docId, {});
			},
			onNodeDragEnd: function(node) {
				// Save sticky node position
				ClientState.getInstance().saveGraphMeta(node.properties.docId, {
					x: node.fx,
					y: node.fy
				});
			},
			onScale: function(data) {
				ClientState.getInstance().saveGlobalGraphMeta(data);
			}
		});
		
		$('.neo4jd3-graph').css('background-color', Config.graphBackgroundColor);
		$('#graphContainer').css('background-color', Config.graphBackgroundColor);
	}
	
	stop() {
		this.graph.stop();	
	}
	
	/**
	 * Adds the passed documents (array of docs) to the graph.
	 */
	addDocuments(docs) {
		if (!docs) return;
		var data = {
			nodes: [],
			relationships: []
		};
		
		// Nodes
		var dd = Notes.getInstance().getData();
		for(var d=0; d<docs.length; ++d) {
			var doc = docs[d];
			
			var nodeId = this.nextNodeId++;
			this.nodeIds.set(doc._id, nodeId);
			
			var weight = 0;
			weight += dd.getChildren(doc._id).length;
			weight += dd.getAllReferences(doc).length;
			weight += dd.getBacklinks(doc).length;
			weight = 1 + (weight / 10);
			if (weight > 20) weight = 20;

			data.nodes.push({
				id: nodeId,
            	labels: [ doc.name ],
				properties: {
					overrideColor: doc.backColor ? doc.backColor : '#ffffff',
					nodeRadius: this.defaultNodeRadius * weight,
					docId: doc._id
				}
			});
		}
			
		// Links
		for(var d=0; d<docs.length; ++d) {
			var doc = docs[d];
			var links = dd.getAllReferences(doc);
		
			for(var l in links) {
				var link = links[l];
				
				var linkNodeId = this.nodeIds.get(link.id);
				if (!linkNodeId) {
					console.log('ERROR: Graph: Broken link in ' + doc._id + ': ' + JSON.stringify(link));
					continue;
				}

				var docNodeId = this.nodeIds.get(doc._id);
				if (!docNodeId) {
					console.log('ERROR: Graph: No node found for ' + doc._id);
					continue;
				}
				
				if (!docNodeId) continue;
				
				data.relationships.push({
					id: this.nextEdgeId++,
					//type: link.type.toUpperCase(),
					source: link.incoming ? linkNodeId : docNodeId,
					target: link.incoming ? docNodeId : linkNodeId,
					properties: {}
				});
			}
		}

		this.graph.updateWithD3Data(data);
		
		// Stickies
		for(var d=0; d<docs.length; ++d) {
			var doc = docs[d];
		
			var meta = ClientState.getInstance().getGraphMeta(doc._id);
			if (meta.x && meta.y) {
				this.graph.eachNode(function(node) {
					if (node.properties.docId == doc._id) {
						node.fx = meta.x;
						node.fy = meta.y;	
					}
				});
			}
		}
		
		// Scaling
		var sc = ClientState.getInstance().getGlobalGraphMeta();
		if (sc) {
			this.graph.setScale(
				sc.scale ? sc.scale : 1, 
				sc.x ? sc.x : 0, 
				sc.y ? sc.y : 0
			);
		}
	}
}