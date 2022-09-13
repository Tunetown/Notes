/**
 * Data container for Notes App
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
class Data {
	
	/**
	 * Create instance with a bulk data array (as received from a 
	 * getAll request to PouchDB as the rows array).
	 */
	constructor(bulkData, nestedDocPropName) {
		this.prepareData(bulkData, nestedDocPropName);
	}
	
	/**
	 * Adds missing values to all documents, and create a keyed map from them
	 * for fast access.
	 */
	prepareData(bulkData, nestedDocPropName) {
		this.data = new Map();
		
		for (var i in bulkData) {
			var doc;
			if (nestedDocPropName) {
				if (!bulkData[i].hasOwnProperty(nestedDocPropName)) {
					throw new Error('INTERNAL ERROR: Invalid nested property name: ' + nestedDocPropName);
				}
				doc = bulkData[i][nestedDocPropName];
			} else {
				doc = bulkData[i];
			}
			
			// Filter out invalid documents
			if (!doc.type) continue;
			if (doc._id == doc.parent) {
				console.log(' -> Filtered document with self-parent: ' + doc._id);
				continue;
			}

			// Filter out deleted documents
			if (doc._deleted) continue;
			
			// Set name if not present
			doc.name = doc.name || doc._id;
			
			Document.strip(doc);

			// Build map of documents
			this.data.set(doc._id, doc);
		}
		
		// Get hierarchy levels (starting from the root items recursively) and other 
		// hierarchy related stuff.
		var rootChildren = this.getChildren();
		this.pHasConflicts = false;
		
		for (var i in rootChildren) {
			if (!this.pHasConflicts && this.hasConflicts(rootChildren[i]._id, true)) {
				this.pHasConflicts = true;
			}
			
			this.applyRecursively(rootChildren[i]._id, function(d, lvl, par) {
				// Set parent reference
				d.parentDoc = par; 

				// Set hierarchy level
				d.level = lvl;
			});
		}
	}
	
	/**
	 * Returns a sort criteria which sorts the items correctly in a hierarchical tree manner.
	 */
	getSortOrderCriteria(doc) {
		var paddedName = doc.name;
		if (paddedName.length > 5) paddedName = paddedName.substring(0, 5);
		if (paddedName.length < 5) paddedName = paddedName.padEnd(5, '_');

		var padded = Tools.pad(doc.order ? doc.order : 0, 10) + paddedName;
		if (doc.parentDoc) {
			return this.getSortOrderCriteria(doc.parentDoc) + padded;
		} else {
			return padded;
		}
	}
	
	/**
	 * Sorts the passed array of documents by getSortOrderCriteria().
	 */
	sortByOrder(docs) {
		var that = this;
		docs.sort(function(a,b) {
			var scA = that.getSortOrderCriteria(a);
			var scB = that.getSortOrderCriteria(b);
			
			if (scA == scB) return 0;
			else if (scA < scB) return -1;
			else return 1;
		});
	}
	
	/**
	 * Add a new document
	 */
	add(doc) {
		doc.name = doc.name || doc._id;
		doc.content = doc.content || '';
		
		doc.parentDoc = this.getById(doc.parent);
		if (doc.parent) {
			doc.level = doc.parentDoc.level + 1 
		} else {
			doc.level = 0;
		}
		if (doc._conflicts && (doc._conflicts.length > 0)) this.pHasConflicts = true;
		
		this.data.set(doc._id, doc);
	}
	
	/**
	 * Sets a new parent for the given doc
	 */
	setParent(id, newParent) {
		var doc = this.getById(id);
		if (!doc) return;

		if (doc.parent == newParent) return;
		
		doc.parent = newParent;
		doc.parentDoc = this.getById(doc.parent);
		
		if (doc.parent) {
			doc.level = doc.parentDoc.level + 1 
		} else {
			doc.level = 0;
		}
	}
	
	/**
	 * Returns if the document is deleted.
	 */
	isDeleted(id) {
		var doc = this.data.get(id);
		if (!doc) return false;
		if (doc.deleted) return true;
		return false;
	}
	
	/**
	 * Returns the document with ID id or null.
	 */
	getById(id) {
		return this.data.get(id);
	}
	
	/**
	 * Returns an array with all references directly pointing to ID.
	 */
	getReferencesTo(id) {
		var ret = [];
		if (!id) return ret;
		
		for(var [key, doc] of this.data) {
			if (doc.ref == id) {
				if (doc.deleted) continue;
				
				ret.push(doc);
			}
		}
		
		return ret;
	}
	
	/**
	 * Returns true if the passed name already exists.
	 */
	documentNameExists(name) {
		for(var [key, doc] of this.data) {
			if (doc.name == name) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Returns the size of the document in bytes, including all content, versions and attachments.
	 * If you pass the errors array, any inaccuracy errors will be recorded there.
	 */
	getSize(doc, includeChildren, errors) {
		var ret = 0;

		if (doc.stub) {
			if (!doc.hasOwnProperty('attachmentSize')) {
				// Document does not have size meta data set correctly
				if (errors) {
					errors.push({
						id: doc._id,
						inaccurate: true
					});
				}
			}
			
			ret += doc.contentSize ? doc.contentSize : 0; 
			ret += doc.attachmentSize ? doc.attachmentSize : 0;
			ret += doc.changeLogSize ? doc.changeLogSize : 0;
		} else {
			ret += doc.content ? doc.content.length : 0;
			
			for(var name in doc._attachments || []) {
				if (!doc._attachments.hasOwnProperty(name)) continue;
				var att = doc._attachments[name];
				if (!att) continue;
				if (!att.length) continue;
				ret += att.length;
			}
			
			if (doc.changeLog) {
				ret += JSON.stringify(doc.changeLog).length;
			}
		}
		
		if (doc.backImage) {
			ret += JSON.stringify(doc.backImage).length;
		}
		
		if (doc.labels) {
			ret += JSON.stringify(doc.labels).length;
		}
		
		// Recurse if requested
		if (includeChildren) {
			var ch = this.getChildren(doc._id);

			for (var c in ch) {
				ret += this.getSize(ch[c], true, errors);
			}
		}
		
		return ret;
	}
	
	/**
	 * Returns all active labels (definitions) for the document.
	 */
	getActiveLabelDefinitions(id) {
		var doc = this.getById(id);
		if (!doc) return [];

		var ret = [];
		for (var i in doc.labels || []) {
			var def = this.getLabelDefinition(doc._id, doc.labels[i]);
			if (!def) continue;
		
			ret.push(def);
		}

		return ret;
	}
	
	/**
	 * Searches for a label definition and returns it, or null if not found.
	 */
	getLabelDefinition(id, labelId) {
		var doc = this.getById(id);
		if (!doc) return null;
		
		for (var l in doc.labelDefinitions || []) {
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
			return this.getLabelDefinition(doc.parent, labelId);
		}
		
		return null;
	}
	
	/**
	 * Returns a list of available label definitions for the document (also containing inherited ones).
	 */
	getLabelDefinitions(id) {
		var ret = [];

		var doc = this.getById(id);
		if (!doc) return ret;

		this.getLabelDefinitionsRec(doc, ret);
		return ret;
	}
	
	/**
	 * Recursive helper for getLabelDefinitions().
	 */
	getLabelDefinitionsRec(doc, ret) {
		for (var l in doc.labelDefinitions || []) {
			var ld = doc.labelDefinitions[l];
			
			ret.push({
				id: ld.id,
				color: ld.color,
				name: ld.name,
				owner: doc._id
			});
		}
		
		if (doc.parentDoc) {
			this.getLabelDefinitionsRec(doc.parentDoc, ret);
		}
	}
	
	/**
	 * Returns all labels definitions
	 */
	getAllLabelDefinitions() {
		var ret = [];

		var ch = this.getChildren('');
		for(var c in ch) {
			var doc = this.getById(ch[c]._id);
			if (!doc) continue;
			
			this.getAllLabelDefinitionsRec(doc, ret);
		}
		return ret;
	}
	
	/**
	 * Recursive helper for getAllLabelDefinitions().
	 */
	getAllLabelDefinitionsRec(doc, ret) {
		for (var l in doc.labelDefinitions || []) {
			var ld = doc.labelDefinitions[l];
			
			ret.push({
				id: ld.id,
				color: ld.color,
				name: ld.name,
				owner: doc._id
			});
		}
		
		var ch = this.getChildren(doc._id);
		for (var c in ch) {
			this.getAllLabelDefinitionsRec(ch[c], ret);
		}
	}
	
	/**
	 * Returns the latest document inside the given doc.
	 */
	getLatest(doc) {
		if (doc.latestDoc) return doc.latestDoc;
		
		var ret = doc;
		
		var ch = this.getChildren(doc._id);
		for (var c in ch) {
			var la = this.getLatest(ch[c]);
			if (la.timestamp > ret.timestamp) ret = la;
		}
		
		doc.latestDoc = ret;
		return ret;
	}
	
	/**
	 * Returns if a document is a (deep) child of another document. Both must be doc IDs.
	 * Also returns true if both are equal.
	 */
	isChildOf(id1, id2) {
		if (!id1 || !id2) return false;
		if (id1 == id2) return true;

		var doc1 = this.data.get(id1);
		if (!doc1) return false;
		
		if (doc1.parent == id2) return true;
		if (!doc1.parent) return false;
		if (doc1.deleted) return false;
		
		return this.isChildOf(doc1.parent, id2);
	}
	
	/**
	 * Returns all direct children of the passed doc ID, as array of documents, unsorted.
	 */
	getChildren(id, deep) {
		if (!id) id = "";
		
		var ret = [];
		for(var [key, doc] of this.data) {
			if (doc.parent == id) {
				if (doc.deleted) continue;
				
				ret.push(doc);
			}
		}
		
		if (deep) {
			var ret2 = [];
			for(var i in ret) {
				ret2.push(ret[i]);
				var chRet = this.getChildren(ret[i]._id, true);
				for(var r in chRet) {
					ret2.push(chRet[r]);
				}
			}
			ret = ret2;
		}

		return ret;
	}
	
	/**
	 * Returns if the passed ID has children or not.
	 */
	hasChildren(id) {
		for(var [key, doc] of this.data) {
			if (doc.deleted) continue;

			if (doc.parent == id) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Returns if the document has conflicts. If includeChildren is set, also
	 * all deep children of the document will be scanned and true will be returned if
	 * any conflicts exist among them.
	 * 
	 * If called without ID, all documents will be regarded.
	 */
	hasConflicts(id, includeChildren) {
		if (!id) {
			return this.pHasConflicts;
		}
		
		var doc = this.getById(id);
		if (!doc) return false;
		if (doc._conflicts && (doc._conflicts.length > 0)) return true;
		
		if (includeChildren) {
			var children = this.getChildren(id);
			for (var c in children) {
				if (!children[c]._id) {
					throw new Error('Child has no ID: ' + JSON.stringify(children[c]));
				}
				if (children[c]._id == children[c].parent) {
					throw new Error('Child is its own parent: ' + JSON.stringify(children[c]));
				}
				
				if (this.hasConflicts(children[c]._id, true)) {
					return true;
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Returns if the document has children or conflicts
	 */
	hasChildrenOrConflicts(id) {
		return this.hasChildren(id) || this.hasConflicts(id);
	}
	
	/**
	 * Calls the callback for the ID item and all items which are under it. 
	 * callback gets called with the doc as parameter, as well as the current 
	 * hierarchy level and the parent document of the doc if any.
	 * 
	 * NOTE: Just leave lvl and par unpassed when calling this!
	 */
	applyRecursively(id, callback, lvl, par) {
		var doc = this.data.get(id);
		if (!doc) return;

		if (!lvl) lvl = 0;
		
		callback(doc, lvl, par);
		
		var children = this.getChildren(id);
		for (var a in children) {
			this.applyRecursively(children[a]._id, callback, lvl + 1, doc);
		}
	}
	
	/**
	 * Apply a callback function to each document (unordered).
	 */
	each(callback) {
		for(var [key, doc] of this.data) {
			if (doc.deleted) continue;
			
			callback(doc);
		}
	}
	
	/**
	 * Returns if the passed document contains the passed search string.
	 */
	containsText(doc, token) {
		if (!doc) return false;
		
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		
		var tokenLowercase = token.toLowerCase();
		
		// Label only search
		if (token.startsWith('label:')) {
			tokenLowercase = tokenLowercase.substring('label:'.length);
			var labels = this.getActiveLabelDefinitions(doc._id);
			
			for (var l in labels) {
				if (labels[l].name.toLowerCase().search(tokenLowercase) != -1) {
					return true;
				}
			}
			return false;
		}
		
		// Name only search
		if (token.startsWith('name:')) {
			tokenLowercase = tokenLowercase.substring('name:'.length);
			if (doc.name.toLowerCase().search(tokenLowercase) != -1) {
				return true;
			}
			return false;
		}

		// Search in all fields //////////////////////////////////////////////////////
		
		// Name
		if (doc.name.toLowerCase().search(tokenLowercase) != -1) {
			return true;
		}
		
		// Content
		if (!doc.content) return false;
		if (doc.content.toLowerCase().search(tokenLowercase) != -1) {
			return true;
		}
		
		// Labels
		var labels = this.getActiveLabelDefinitions(doc._id);
		
		for (var l in labels) {
			if (labels[l].name.toLowerCase().search(tokenLowercase) != -1) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * For an ID, this returns a readable name path to root.
	 */
	getReadablePath(id, separator) {
		if (!separator) separator = " / ";
		var doc = this.data.get(id);
		if (!doc) return 'InvalidID';
		
		var path = this.getReadablePathRec(doc);

		var ret = "";
		for(var i=path.length-1; i>=0; --i) {
			ret += path[i] + separator;   
		}
		
		return ret;
	}
	
	/**
	 * Recursive Helper for getReadablePath().
	 */
	getReadablePathRec(doc, ret) {
		if (!ret) ret = [];
		
		ret.push(doc.name ? doc.name : doc._id);
		
		if (!doc.parentDoc) {
			ret.push(Config.ROOT_NAME);  
			return ret;
		} else {
			return this.getReadablePathRec(doc.parentDoc, ret);
		}
	}
	
	/**
	 * Get a speaking document id from a string.
	 */
	generateIdFrom(str) {
		var s = str.replace(/[^a-zA-Z0-9]/g, "-");
		if (s.length > 30) s = s.substring(0, 30);
		var ret = s + '-' + Tools.getUuid();
		if (this.getById(ret)) throw new Error('INTERNAL ERROR: Generated ID already exists: ' + ret);
		return ret;
	}
}