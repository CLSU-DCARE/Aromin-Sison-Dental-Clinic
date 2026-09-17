<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

require_role('receptionist');

$method = \ASDC\ApiResponse::method('GET', 'POST', 'PATCH', 'DELETE');
$pdo = \ASDC\Database::pdo();

function inventory_item_payload(array $row): array
{
    return [
        'id' => (int) $row['item_id'],
        'item' => $row['item_name'],
        'category' => $row['category'],
        'qty' => (int) $row['stock_quantity'],
        'unit' => $row['unit'],
        'reorder_level' => (int) $row['reorder_level'],
        'last_restocked' => $row['last_restocked'],
    ];
}

function fetch_inventory_items(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT item_id,item_name,category,stock_quantity,unit,reorder_level,last_restocked FROM inventory_items ORDER BY item_name');
    return array_map('inventory_item_payload', $stmt->fetchAll());
}

if ($method === 'GET') {
    \ASDC\ApiResponse::ok(['inventory' => fetch_inventory_items($pdo)]);
}

\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();

if ($method === 'DELETE') {
    $itemId = \ASDC\InputValidator::positiveId($body['item_id'] ?? $body['id'] ?? null);
    if (!$itemId) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid inventory item to delete.');
    }

    $stmt = $pdo->prepare('DELETE FROM inventory_items WHERE item_id = ?');
    $stmt->execute([$itemId]);
    if ($stmt->rowCount() < 1) {
        \ASDC\ApiResponse::error(404, 'not_found', 'Inventory item not found.');
    }

    \ASDC\ApiResponse::ok(['inventory' => fetch_inventory_items($pdo)], 'Inventory item deleted.');
}

$itemId = null;
if ($method === 'PATCH') {
    $itemId = \ASDC\InputValidator::positiveId($body['item_id'] ?? $body['id'] ?? null);
    if (!$itemId) {
        \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid inventory item to update.');
    }
}

$name = trim((string) ($body['item_name'] ?? $body['item'] ?? ''));
$category = trim((string) ($body['category'] ?? 'Consumable'));
$qty = filter_var($body['stock_quantity'] ?? $body['qty'] ?? null, FILTER_VALIDATE_INT);
$unit = trim((string) ($body['unit'] ?? ''));
$reorderLevel = filter_var($body['reorder_level'] ?? 10, FILTER_VALIDATE_INT);
$lastRestocked = trim((string) ($body['last_restocked'] ?? ''));

$fields = [];
if ($name === '' || mb_strlen($name) > 150) $fields['item_name'] = 'Enter an item name up to 150 characters.';
if ($category === '' || mb_strlen($category) > 100) $fields['category'] = 'Choose a valid category.';
if ($qty === false || $qty < 0) $fields['stock_quantity'] = 'Enter a stock quantity of 0 or higher.';
if (mb_strlen($unit) > 30) $fields['unit'] = 'Enter a unit up to 30 characters.';
if ($reorderLevel === false || $reorderLevel < 0) $fields['reorder_level'] = 'Enter a reorder point of 0 or higher.';
if ($lastRestocked !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $lastRestocked)) $fields['last_restocked'] = 'Choose a valid restock date.';
if ($fields) \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', $fields);

$lastRestocked = $lastRestocked !== '' ? $lastRestocked : null;

if ($method === 'POST') {
    $stmt = $pdo->prepare(
        'INSERT INTO inventory_items(item_name,category,stock_quantity,unit,reorder_level,last_restocked) VALUES(?,?,?,?,?,?)'
    );
    $stmt->execute([$name, $category, $qty, $unit, $reorderLevel, $lastRestocked]);
    \ASDC\ApiResponse::ok(['inventory' => fetch_inventory_items($pdo)], 'Inventory item added.', 201);
}

$stmt = $pdo->prepare(
    'UPDATE inventory_items SET item_name = ?, category = ?, stock_quantity = ?, unit = ?, reorder_level = ?, last_restocked = ? WHERE item_id = ?'
);
$stmt->execute([$name, $category, $qty, $unit, $reorderLevel, $lastRestocked, $itemId]);
if ($stmt->rowCount() < 1) {
    $exists = $pdo->prepare('SELECT item_id FROM inventory_items WHERE item_id = ?');
    $exists->execute([$itemId]);
    if (!$exists->fetch()) {
        \ASDC\ApiResponse::error(404, 'not_found', 'Inventory item not found.');
    }
}

\ASDC\ApiResponse::ok(['inventory' => fetch_inventory_items($pdo)], 'Inventory item updated.');
