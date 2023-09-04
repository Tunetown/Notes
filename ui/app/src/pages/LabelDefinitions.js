/**
 * Label definitions overview.
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
class LabelDefinitions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!LabelDefinitions.instance) LabelDefinitions.instance = new LabelDefinitions();
		return LabelDefinitions.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	load(doc) {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		this.current = doc;
		
		if (doc) {
			n.setStatusText("Label definitions of " + doc.name);
		} else {
			n.setStatusText("All Label definitions");
		}
		
		// Clear list
		$('#contentContainer').empty();
		
		// Get list of labels
		var labels = doc ? n.getData().getLabelDefinitions(doc._id) : n.getData().getAllLabelDefinitions();

		// Build new table from the data
		var rows = new Array();
		var that = this;
		for(var i in labels || []) {
			var label = labels[i];
			if (!label.id) continue;
			 
			// Is the label checked for the current document?
			var docHasLabel = doc ? Document.hasLabel(doc, label.id) : false;
			
			// Action buttons (only for current document's labels)
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Search for items with label" class="fa fa-search versionButton" data-owner="' + label.owner + '" data-id="' + label.id + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						var id = $(this).data().id;
						var owner = $(this).data().owner;

						that.searchLabel(id, owner);
					}),
					!(!doc || (label.owner == doc._id)) ? null : $('<div data-toggle="tooltip" title="Move label definition" class="fa fa-arrows-alt versionButton" data-owner="' + label.owner + '" data-id="' + label.id + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						var id = $(this).data().id;
						var owner = $(this).data().owner;

						that.moveLabelDefinition(id, owner);
					}),
					!(!doc || (label.owner == doc._id)) ? null : $('<div data-toggle="tooltip" title="Delete label definition" class="fa fa-trash versionButton" data-owner="' + label.owner + '" data-id="' + label.id + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						var id = $(this).data().id;
						var owner = $(this).data().owner;
						
						that.deleteLabelDefinition(id, owner);
					})
				]
			);
			
			var ownerLink;
			var ownerPath;
			if (!doc || (label.owner != doc._id)) {
				var ownerDoc = n.getData().getById(label.owner);
				ownerPath = n.getData().getReadablePath(ownerDoc._id);
				ownerLink = $('<span class="listLink" data-owner="' + ownerDoc._id + '">' + ownerPath + '</span>')
				.on('click', function(event) {
					event.stopPropagation();
					var owner = $(this).data().owner;
					if (!owner) return;
					
					Notes.getInstance().routing.call(owner);
				})
			} else {
				ownerPath = n.getData().getReadablePath(doc._id);
				ownerLink = $('<span class="listInactive"></span>').html(ownerPath);
			}
			
			rows.push(
				//$('<tr style="background-color: ' + label.color + ';">')
				$('<tr>')
				.append(
					[
						$('<td></td>').append(
							!doc ? null :
							$('<input class="checkbox-switch" type="checkbox" data-id="' + label.id + '" ' + (docHasLabel ? 'checked' : '') + ' />')
							.each(function(i) {
								var that2 = this;
								setTimeout(function() {
									new Switch(that2, {
										size: 'small',
										onSwitchColor: '#337ab7',
										onChange: function() {
											var id = $(that2).data().id;
											that.setLabel(id, !!this.getChecked());
										}
									});
								}, 0);
							})
						),
						
						$('<td data-name="' + label.name + '"></td>').append(
							$('<span class="listLink" data-owner="' + label.owner + '" data-id="' + label.id + '"></span>')
							.html(label.name)
							.on('click', function(e) {
								e.stopPropagation();
								var id = $(this).data().id;
								var owner = $(this).data().owner;

								that.renameLabelDefinition(id, owner);
							})							
						),
						
						$('<td/>').append(
							(doc && (label.owner != doc._id)) 
							? 
								$('<div class="doc-label doc-label-labellist"></div>')
								.css('background-color', label.color)
							: 
								$('<input type="color" data-owner="' + label.owner + '" data-id="' + label.id + '" value="' + label.color + '">')
								.on('blur', function(event) {
						        	event.stopPropagation();
						        	var id = $(this).data().id;
						        	var owner = $(this).data().owner;
									
									that.setLabelDefinitionColor(id, owner, $(this).val())
						        })
						),

						$('<td data-path="' + ownerPath + '"></td>').append(
							ownerLink
						),
						
						$('<td/>').append(
							butts
						),
					]					
				)
			);
		}
		
		$('#contentContainer').append(
			!this.current ? null : 
			$('<div style="padding: 15px;"></div>').append(
				$('<a style="cursor: pointer;">Convert all labels of ' + this.current.name + ' to hashtags</a>')
				.on('click', function(event) {
					LabelActions.getInstance().convertLabelsToTags(that.current)
					.then(function(ret) {
						if (ret && ret.message) {
							Notes.getInstance().showAlert(ret.message, 'S');
						}
					})
					.catch(function(err) {
						if (err && err.message) alert(err.message);
					});
				}),
			),
			
			$('<table class="table table-striped table-hover" id="labelsTable" />').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th>Active</th>'),
								$('<th>Name</th>'),
								$('<th>Color</th>'),
								$('<th>Defined in</th>'),
								$('<th>Actions</th>'),
							]
						)
					),
					$('<tbody/>').append(rows),
				]
			),
			
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		Tools.makeTableSortable($('#labelsTable'), {
			excludeColumns: [0, 4],
			sortData: [
				{
					colIndex: 1,
					getValue: function(td) {
						return $(td).data().name.toLowerCase();
					}
				},
				{
					colIndex: 2,
					getValue: function(td) {
						var ip = $(td).find('input');
						return ip ? ip.val() : '';
					}
				},
				{
					colIndex: 3,
					getValue: function(td) {
						return $(td).data().path.toLowerCase();
					}
				},
			]
		});
		
		// Buttons
		if (doc) {
			n.setButtons([ 
				$('<div type="button" data-toggle="tooltip" title="Add label" class="fa fa-plus" onclick="event.stopPropagation();LabelDefinitions.getInstance().addLabelDefinition()"></div>') 
			]);	
		}
	}
	
	/**
	 * Unload instance
	 */
	unload() {
		this.current = null;
	}
	
	/**
	 * Triggers (delayed) saving of the items labels
	 */
	triggerSaveLabels() {
		if (this.saveLabelsHandler) clearTimeout(this.saveLabelsHandler);
		
		if (!this.current) return;
		
		var d = Notes.getInstance().getData();
		var doc = d.getById(this.current._id);
		if (!doc) return;
		
		var that = this;
		this.saveLabelsHandler = setTimeout(function() {
			var labels = doc.labels;
			DocumentAccess.getInstance().loadDocuments([doc])
			.then(function(/*resp*/) {
				doc.labels = labels;
				
				return LabelActions.getInstance().saveLabels(doc._id);
			})
			.then(function(/*data*/) {
				if (!that.current) return;
				
				var docl = d.getById(doc._id);
				if (!docl) return;
				
				that.load(docl);
			})
			.catch(function(err) {
				Notes.getInstance().showAlert(err.message ? err.message : 'Error saving labels for ' + doc.name, err.abort ? 'I' : 'E', err.messageThreadId);
			});
		}, 1000);
	}
	
	/**
	 * Adds the passed label id to the current document
	 */
	setLabel(id, shouldBeSet) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(this.current._id);
		if (!doc) return;
		
		if (!Document.toggleLabel(doc, id, shouldBeSet)) return;
		
		// Trigger saving delayed to prevent locking conflicts
		this.triggerSaveLabels();
	}
	
	/**
	 * Set a labels color
	 */
	setLabelDefinitionColor(id, owner, color) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(owner);
		if (!doc) return;
		
		var that = this;
		DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			var def = Document.getLabelDefinition(doc, id);
			def.color = color;
			
			return LabelActions.getInstance().saveLabelDefinitions(doc._id);
		})
		.then(function(/*data*/) {
			that.load(that.current);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message ? err.message : 'Error saving label definitions', err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Rename a label definition
	 */
	renameLabelDefinition(id, owner) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(owner);
		if (!doc) return;
		
		var that = this;
		DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(resp) {
			var def = Document.getLabelDefinition(doc, id);
			
			var name = prompt('Name for label: ', def.name);
			if (!name) return;
			def.name = name;
		
			return LabelActions.getInstance().saveLabelDefinitions(doc._id)
		})
		.then(function(data) {
			that.load(that.current);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message ? err.message : 'Error saving label definitions', err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Delete a label definition
	 */
	deleteLabelDefinition(id, owner) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(owner);
		if (!doc) return;
		
		var that = this;
		DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			var def = Document.getLabelDefinition(doc, id);
			
			if (!confirm('Really delete label ' + def.name + '?')) return Promise.reject({
				message: 'Action canceled.',
				messageThreadId: 'LoadDocumentMessages',
				abort: true
			});
			
			if (!Document.removeLabelDefinition(doc, id)) return Promise.resolve({
				noReload: true,
				ok: true
			});
		
			return LabelActions.getInstance().saveLabelDefinitions(doc._id);
		})
		.then(function(data) {
			if (!data || !data.noReload) that.load(that.current);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message ? err.message : 'Error saving label definitions', err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Move a label definition
	 */
	moveLabelDefinition(id, owner) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(owner);
		if (!doc) return;
		
		//var def = Document.getLabelDefinition(doc, id);
		
		//var that = this;
		LabelActions.getInstance().moveLabelDefinition(doc._id, id)
		.then(function(data) {
			if (data.newOwner) Notes.getInstance().routing.callLabelDefinitions(data.newOwner);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message ? err.message : 'Error saving label definitions', err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Add a label
	 */
	addLabelDefinition() {
		if (!this.current) return;
		
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(this.current._id);
		if (!doc) return;
		
		var name = prompt('Name for the new label: ');
		if (!name) return;
		
		var that = this;
		DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(resp) {
			Document.addLabelDefinition(doc, {
				name: name
			});
		
			return LabelActions.getInstance().saveLabelDefinitions(doc._id);
		})
		.then(function(data) {
			that.load(that.current);
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message ? err.message : 'Error creating new label', err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Search for the label
	 */
	searchLabel(id, owner) {
		var d = Notes.getInstance().getData();
		
		var doc = d.getById(owner);
		if (!doc) return;
		
		var def = Document.getLabelDefinition(doc, id);
		if (!def) return;
		
		if (Device.getInstance().isLayoutMobile()) {
			Notes.getInstance().routing.call();
		}
		
		setTimeout(function() {
			NoteTree.getInstance().setSearchText('label:' + def.name);
		}, 0);
	}
	
	/**
	 * Check document labels and definitions.
	 */
	static check(doc, errors, allDocs) {
		for(var l in doc.labelDefinitions || []) {
			var def = doc.labelDefinitions[l];
			
			if (!def.name) {
				errors.push({
					message: 'Label definition name is missing: ' + JSON.stringify(def),
					id: doc._id,
					type: 'E',
					solver: function(pDoc) {
						for (var ll in pDoc.labelDefinitions) {
							if (!pDoc.labelDefinitions[ll].name) pDoc.labelDefinitions[ll].name = pDoc.labelDefinitions[ll].id;
						}
					}
				});		
			} 
			if (!def.id) {
				errors.push({
					message: 'Label definition ID is missing: ' + JSON.stringify(def),
					id: doc._id,
					type: 'E',
					solver: function(pDoc) {
						for (var ll in pDoc.labelDefinitions) {
							if (!pDoc.labelDefinitions[ll].id) pDoc.labelDefinitions[ll].id = Notes.getInstance().getData().generateIdFrom(pDoc.labelDefinitions[ll].name);
						}
					}
				});		
			}
			if (!def.color) {
				errors.push({
					message: 'Label definition color is missing: ' + JSON.stringify(def),
					id: doc._id,
					type: 'E',
					solver: function(pDoc) {
						for (var ll in pDoc.labelDefinitions) {
							if (!pDoc.labelDefinitions[ll].color) pDoc.labelDefinitions[ll].color = '#06feab';
						}
					}
				});		
			} 

			if (allDocs) {
				// Check uniqueness among other documents
				for(var a in allDocs) {
					var adoc = allDocs[a].doc;
					if (adoc._id == doc._id) continue;
					
					if (adoc.labelDefinitions) {
						for (var ad in adoc.labelDefinitions) {
							var adef = adoc.labelDefinitions[ad];
							if (adef.id == def.id) {
								errors.push({
									message: 'Label definition not unique: ' + def.id + ' also found in ' + adoc._id,
									id: doc._id,
									type: 'E'
								});	
							}
						}
					}
				}
			}
		}
		
		if (allDocs) {
			for(var l in doc.labels || []) {
				var label = doc.labels[l];
				
				// Check if definition can be found
				var adef = LabelDefinitions.getLabelDefinitionForChecks(doc._id, label, allDocs);
				if (!adef) {
					errors.push({
						message: 'Label definition not found: ' + label,
						id: doc._id,
						type: 'W',
						solver: function(pDoc) {
							pDoc.labels = [];
						}
					});	
				}
			}
		}
	}
	
	/**
	 * Searches for a label definition and returns it, or null if not found.
	 * Only used for check.
	 */
	static getLabelDefinitionForChecks(docId, labelId, allDocs) {
		var doc = null;
		for(var a in allDocs) {
			if (allDocs[a].doc._id == docId) {
				doc = allDocs[a].doc;
				break;
			}
		}
		if (!doc) return null;
		
		for(var l in doc.labelDefinitions || []) {
			if (doc.labelDefinitions[l].id == labelId) {
				return {
					id: doc.labelDefinitions[l].id,
					color: doc.labelDefinitions[l].color,
					name: doc.labelDefinitions[l].name,
					owner: doc._id
				};
			}
		}
		
		if (doc.parent) {
			return this.getLabelDefinitionForChecks(doc.parent, labelId, allDocs);
		}
		
		return null;
	}
}