/**
 * Undo manager for notes app.
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
class UndoManager {
	
	static experimentalFunctionId = 'UndoManager';
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!UndoManager.instance) UndoManager.instance = new UndoManager();
		return UndoManager.instance;
	}
	
	constructor() {
		this.history = [];
		this.position = -1;
	}

	static STEP_TYPE_DOCUMENT_BASED = 'doc';
	static STEP_TYPE_CALLBACK_BASED = 'callback';

	/**
	 * Adds a new undo step. This invalidates all steps after the current position.
	 *
	 * A step can be one of the following (all attributes are mandatory):
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_DOCUMENT_BASED,
	 *   name: 'Name of the undo step'
	 *   doc: [Document Object to be saved to make things undone],
	 *   finishedCallback: function(step) => Promise [Callback called after performing the step]
	 * }
	 *  
	 * or: 
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_CALLBACK_BASED,
	 *   name: 'Name of the undo step'
	 *   undoCallback: [Callback function for undoing, parameter: the step object itself],
	 *   redoCallback: [Callback function for redoing, parameter: the step object itself],
	 *   finishedCallback: function(step) => Promise [Callback called after performing the step]
	 * }
	 *  
	 */
	add(step) {
		this.#checkStep(step);
		this.#condense();
		
		this.history.push(step);
		++this.position;
		this.#checkHistory();
		
		console.log(' -> UNDO MANAGER: Added step "' + step.name + '". Position: ' + this.position + ' of ' + this.history.length);
	}
	
	/**
	 * Is there a undo step to be undone? 
	 */
	canUndo() {
		return this.position >= 0;
	}
	
	/**
	 * Is redoing possible?
	 */
	canRedo() {
		return (this.position < (this.history.length - 1));
	}
	
	/**
	 * Returns the next undo step or null.
	 */
	getNextUndoStep() {
		if (!this.canUndo()) return null;
		
		if (this.position < 0) throw new Error('Invalid position: ' + this.position);
		if (this.position >= this.history.length) throw new Error('Invalid position: ' + this.position);
		
		const step = this.history[this.position];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Returns the next redo step or null.
	 */
	getNextRedoStep() {
		if (!this.canRedo()) return null;
		
		if (this.position < 0) throw new Error('Invalid position: ' + this.position);
		if (this.position >= (this.history.length - 1)) throw new Error('Invalid position: ' + this.position);
		
		const step = this.history[this.position + 1];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Undo last step. Returns a promise.
	 */
	undo() {
		if (!this.canUndo()) return Promise.resolve();
		
		const step = this.getNextUndoStep();
		--this.position;

		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Document undo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedUndoStep(step);
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedUndoStep(step);
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	/**
	 * Redo last undone step. Returns a promise.
	 */
	redo() {
		if (!this.canRedo()) return Promise.resolve();
		
		const step = this.getNextRedoStep();
		++this.position;
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Document redo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedRedoStep(step);
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedRedoStep(step);
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Document undo step: These store the document to be saved to make the step undone.
	 */
	#performDocumentBasedUndoStep(step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo for document ' + step.doc._id + '; New Position: ' + this.position + ' of ' + this.history.length);
		
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.doc)
		.then(function(resp) {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			step.redoDoc = resp.oldDoc;
			
			return step.finishedCallback(step);
		})
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Document redo step: The undo step before saved a redo document.
	 */
	#performDocumentBasedRedoStep(step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform redo for document ' + step.redoDoc._id + '; New Position: ' + this.position + ' of ' + this.history.length);
		
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.redoDoc)
		.then(function() {
			return step.finishedCallback(step);
		})
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based undo step: Executes the passed undo callback with the undo step object as single parameter.
	 */
	#performCallbackBasedUndoStep(step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo by callback; New Position: ' + this.position + ' of ' + this.history.length);
		return step.undoCallback(step)
		.then(function() {
			return step.finishedCallback(step);
		})
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based redo step: Executes the passed redo callback with the undo step object as single parameter.
	 */
	#performCallbackBasedRedoStep(step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform redo by callback; New Position: ' + this.position + ' of ' + this.history.length);
		return step.redoCallback(step)
		.then(function() {
			return step.finishedCallback(step);
		})
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Removes all steps after the current position.
	 */
	#condense() {
		console.log(' -> UNDO MANAGER: Condensing history, current size: ' + this.history.length + ' ...');
		
		while(this.history.length > (this.position + 1)) {
			this.history.pop();
		}
		
		this.#checkHistory();
		
		console.log('              ... new size: ' + this.history.length + ', position: ' + this.position);
	}
	
	/**
	 * Check step consistency.
	 */
	#checkStep(step) {
		if (!step) throw new Error('No step data');
		if (!step.type) throw new Error('No step type');
		if (!step.name) throw new Error('No step name');
		if (!step.finishedCallback) throw new Error('No finished callback');
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.doc) throw new Error('No undo document for doc based step');
			return;
		}
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.undoCallback) throw new Error('No undo callback for callback based undo step');
			if (!step.redoCallback) throw new Error('No redo callback for callback based undo step');
			return;
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}
	
	/**
	 * Checks the history and position.
	 */
	#checkHistory() {
		if (this.position != (this.history.length - 1)) throw new Error('Internal Error: Inconsisten UndoManager position');
		
		for(var i in this.history) {
			const step = this.history[i];
			
			this.#checkStep(step);
			
			if (i > this.position) {
				if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
					if (!step.redoDoc) throw new Error('Internal Error: Undoed step "' + step.name + '" does not have a redo document at positon ' + i + ' of ' + this.history.length);
				}
			}
		}
	}
}