// Spinifex - Edit Mode Tests
// Tests for vector layer edit functionality with undo/redo

import { test, expect } from '@playwright/test';

test.describe('Edit Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.sp !== undefined, { timeout: 10000 });
    // Load sample data to have vector layers to test with
    await page.evaluate(() => sp.load(sp.sample));
    await page.waitForFunction(() => Object.keys(window.ly).length > 0, { timeout: 5000 });
  });

  test.describe('Edit Mode Lifecycle', () => {
    test('layer has isEditing property', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return layer?.isEditing !== undefined;
      });
      expect(result).toBe(true);
    });

    test('isEditing is initially false', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return layer?.isEditing;
      });
      expect(result).toBe(false);
    });

    test('startEditing() enters edit mode', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        return layer.isEditing;
      });
      expect(result).toBe(true);
    });

    test('stopEditing() exits edit mode', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        layer.stopEditing();
        return layer.isEditing;
      });
      expect(result).toBe(false);
    });

    test('cannot edit without calling startEditing()', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        // Should return null or false when not in edit mode
        const addResult = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        return addResult;
      });
      expect(result).toBeFalsy();
    });
  });

  test.describe('Feature CRUD Operations', () => {
    test('addFeature() creates new point feature', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        const feature = layer.addFeature(
          { type: 'Point', coordinates: [145, -37] },
          { name: 'Test Point' }
        );
        layer.stopEditing(true);
        return {
          featureExists: !!feature,
          featureHasId: !!feature?.id,
          countIncreased: layer.count === originalCount + 1,
          hasProperties: feature?.properties?.name === 'Test Point'
        };
      });
      expect(result.featureExists).toBe(true);
      expect(result.featureHasId).toBe(true);
      expect(result.countIncreased).toBe(true);
      expect(result.hasProperties).toBe(true);
    });

    test('addFeature() creates new polygon feature', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature({
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
        });
        layer.stopEditing(true);
        return {
          featureExists: !!feature,
          geometryType: feature?.geometry?.type
        };
      });
      expect(result.featureExists).toBe(true);
      expect(result.geometryType).toBe('Polygon');
    });

    test('updateFeature() modifies properties', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature(
          { type: 'Point', coordinates: [0, 0] },
          { name: 'Original' }
        );
        const updated = layer.updateFeature(feature.id, {
          properties: { name: 'Updated' }
        });
        layer.stopEditing(true);
        // Find the feature in geojson
        const found = layer.geojson.features.find(f => f.id === feature.id);
        return {
          updateSucceeded: updated !== null,
          nameUpdated: found?.properties?.name === 'Updated'
        };
      });
      expect(result.updateSucceeded).toBe(true);
      expect(result.nameUpdated).toBe(true);
    });

    test('updateFeature() modifies geometry', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.updateFeature(feature.id, {
          geometry: { type: 'Point', coordinates: [100, 50] }
        });
        layer.stopEditing(true);
        const found = layer.geojson.features.find(f => f.id === feature.id);
        return {
          coordsUpdated: found?.geometry?.coordinates[0] === 100 &&
                         found?.geometry?.coordinates[1] === 50
        };
      });
      expect(result.coordsUpdated).toBe(true);
    });

    test('deleteFeature() removes feature', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const countAfterAdd = layer.count;
        const deleted = layer.deleteFeature(feature.id);
        const countAfterDelete = layer.count;
        layer.stopEditing(true);
        return {
          deleteSucceeded: deleted === true,
          countDecreased: countAfterDelete === countAfterAdd - 1
        };
      });
      expect(result.deleteSucceeded).toBe(true);
      expect(result.countDecreased).toBe(true);
    });

    test('features get unique IDs', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const f1 = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const f2 = layer.addFeature({ type: 'Point', coordinates: [1, 1] });
        const f3 = layer.addFeature({ type: 'Point', coordinates: [2, 2] });
        layer.stopEditing(true);
        return {
          allHaveIds: !!f1.id && !!f2.id && !!f3.id,
          idsUnique: f1.id !== f2.id && f2.id !== f3.id && f1.id !== f3.id
        };
      });
      expect(result.allHaveIds).toBe(true);
      expect(result.idsUnique).toBe(true);
    });
  });

  test.describe('Undo/Redo Stack', () => {
    test('canUndo() is false initially', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const canUndo = layer.canUndo();
        layer.stopEditing();
        return canUndo;
      });
      expect(result).toBe(false);
    });

    test('canUndo() is true after action', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const canUndo = layer.canUndo();
        layer.stopEditing();
        return canUndo;
      });
      expect(result).toBe(true);
    });

    test('canRedo() is false initially', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const canRedo = layer.canRedo();
        layer.stopEditing();
        return canRedo;
      });
      expect(result).toBe(false);
    });

    test('canRedo() is true after undo', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.undo();
        const canRedo = layer.canRedo();
        layer.stopEditing();
        return canRedo;
      });
      expect(result).toBe(true);
    });

    test('undo() reverts add operation', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const countAfterAdd = layer.count;
        layer.undo();
        const countAfterUndo = layer.count;
        layer.stopEditing();
        return {
          addedOne: countAfterAdd === originalCount + 1,
          undidOne: countAfterUndo === originalCount
        };
      });
      expect(result.addedOne).toBe(true);
      expect(result.undidOne).toBe(true);
    });

    test('redo() reapplies add operation', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.undo();
        const countAfterUndo = layer.count;
        layer.redo();
        const countAfterRedo = layer.count;
        layer.stopEditing();
        return {
          undidOne: countAfterUndo === originalCount,
          redidOne: countAfterRedo === originalCount + 1
        };
      });
      expect(result.undidOne).toBe(true);
      expect(result.redidOne).toBe(true);
    });

    test('undo() reverts delete operation', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const countAfterAdd = layer.count;
        layer.deleteFeature(feature.id);
        const countAfterDelete = layer.count;
        layer.undo();
        const countAfterUndo = layer.count;
        layer.stopEditing();
        return {
          deletedOne: countAfterDelete === countAfterAdd - 1,
          undidDelete: countAfterUndo === countAfterAdd
        };
      });
      expect(result.deletedOne).toBe(true);
      expect(result.undidDelete).toBe(true);
    });

    test('undo() reverts update operation', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const feature = layer.addFeature(
          { type: 'Point', coordinates: [0, 0] },
          { name: 'Original' }
        );
        layer.updateFeature(feature.id, { properties: { name: 'Updated' } });
        const found1 = layer.geojson.features.find(f => f.id === feature.id);
        const nameAfterUpdate = found1.properties.name;
        layer.undo();
        const found2 = layer.geojson.features.find(f => f.id === feature.id);
        const nameAfterUndo = found2.properties.name;
        layer.stopEditing();
        return {
          wasUpdated: nameAfterUpdate === 'Updated',
          wasUndone: nameAfterUndo === 'Original'
        };
      });
      expect(result.wasUpdated).toBe(true);
      expect(result.wasUndone).toBe(true);
    });

    test('multiple undo/redo operations work correctly', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();

        // Add three features
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.addFeature({ type: 'Point', coordinates: [1, 1] });
        layer.addFeature({ type: 'Point', coordinates: [2, 2] });
        const countAfter3 = layer.count;

        // Undo all three
        layer.undo();
        layer.undo();
        layer.undo();
        const countAfter3Undos = layer.count;

        // Redo two
        layer.redo();
        layer.redo();
        const countAfter2Redos = layer.count;

        layer.stopEditing();
        return {
          addedThree: countAfter3 === originalCount + 3,
          undidAll: countAfter3Undos === originalCount,
          redidTwo: countAfter2Redos === originalCount + 2
        };
      });
      expect(result.addedThree).toBe(true);
      expect(result.undidAll).toBe(true);
      expect(result.redidTwo).toBe(true);
    });

    test('redo stack clears on new action', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.undo();
        const canRedoBefore = layer.canRedo();
        layer.addFeature({ type: 'Point', coordinates: [1, 1] }); // New action
        const canRedoAfter = layer.canRedo();
        layer.stopEditing();
        return {
          couldRedoBefore: canRedoBefore,
          cannotRedoAfter: !canRedoAfter
        };
      });
      expect(result.couldRedoBefore).toBe(true);
      expect(result.cannotRedoAfter).toBe(true);
    });

    test('undo when stack is empty is a no-op', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.undo(); // Should do nothing
        layer.undo(); // Should do nothing
        const countAfter = layer.count;
        layer.stopEditing();
        return countAfter === originalCount;
      });
      expect(result).toBe(true);
    });

    test('redo when stack is empty is a no-op', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.redo(); // Should do nothing
        layer.redo(); // Should do nothing
        const countAfter = layer.count;
        layer.stopEditing();
        return countAfter === originalCount;
      });
      expect(result).toBe(true);
    });
  });

  test.describe('stopEditing with save parameter', () => {
    test('stopEditing(true) saves changes', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.stopEditing(true); // save = true
        return layer.count === originalCount + 1;
      });
      expect(result).toBe(true);
    });

    test('stopEditing(false) reverts all changes', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.addFeature({ type: 'Point', coordinates: [1, 1] });
        layer.addFeature({ type: 'Point', coordinates: [2, 2] });
        layer.stopEditing(false); // save = false, revert all
        return layer.count === originalCount;
      });
      expect(result).toBe(true);
    });

    test('stopEditing() defaults to saving', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        const originalCount = layer.count;
        layer.startEditing();
        layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        layer.stopEditing(); // No argument, should default to true
        return layer.count === originalCount + 1;
      });
      expect(result).toBe(true);
    });
  });

  test.describe('deleteSelected Integration', () => {
    test('deleteSelected() removes selected features', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const f1 = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const f2 = layer.addFeature({ type: 'Point', coordinates: [1, 1] });
        const countAfterAdd = layer.count;

        // Select first feature
        layer.select(f1.id);
        const deleted = layer.deleteSelected();
        const countAfterDelete = layer.count;

        layer.stopEditing();
        return {
          deletedOne: deleted === 1,
          countDecreased: countAfterDelete === countAfterAdd - 1
        };
      });
      expect(result.deletedOne).toBe(true);
      expect(result.countDecreased).toBe(true);
    });

    test('deleteSelected() with multiple selected', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        layer.startEditing();
        const f1 = layer.addFeature({ type: 'Point', coordinates: [0, 0] });
        const f2 = layer.addFeature({ type: 'Point', coordinates: [1, 1] });
        const f3 = layer.addFeature({ type: 'Point', coordinates: [2, 2] });
        const countAfterAdd = layer.count;

        // Select all three
        layer.select([f1.id, f2.id, f3.id]);
        const deleted = layer.deleteSelected();
        const countAfterDelete = layer.count;

        layer.stopEditing();
        return {
          deletedThree: deleted === 3,
          countDecreased: countAfterDelete === countAfterAdd - 3
        };
      });
      expect(result.deletedThree).toBe(true);
      expect(result.countDecreased).toBe(true);
    });
  });

  test.describe('canUndo and canRedo methods', () => {
    test('canUndo() method exists', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer.canUndo === 'function';
      });
      expect(result).toBe(true);
    });

    test('canRedo() method exists', async ({ page }) => {
      const result = await page.evaluate(() => {
        const layer = Object.values(window.ly).find(l => l.type === 'vector');
        return typeof layer.canRedo === 'function';
      });
      expect(result).toBe(true);
    });
  });
});
