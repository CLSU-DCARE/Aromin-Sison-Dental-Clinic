<?php
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';
require_role('receptionist');

$method = \ASDC\ApiResponse::method('GET', 'POST', 'PATCH', 'DELETE');
$pdo = \ASDC\Database::pdo();
function usage_rules(PDO $pdo): array {
    return $pdo->query('SELECT r.rule_id,r.service_name,r.item_id,r.quantity_required,i.item_name,i.unit FROM inventory_usage_rules r JOIN inventory_items i ON i.item_id=r.item_id ORDER BY r.service_name,i.item_name')->fetchAll();
}
if ($method === 'GET') \ASDC\ApiResponse::ok(['rules' => usage_rules($pdo)]);
\ASDC\CsrfToken::requireValid();
$body = \ASDC\ApiResponse::requireJson();
if ($method === 'DELETE') {
    $id = \ASDC\InputValidator::positiveId($body['rule_id'] ?? null);
    $stmt = $pdo->prepare('DELETE FROM inventory_usage_rules WHERE rule_id=?'); $stmt->execute([$id]);
    if (!$stmt->rowCount()) \ASDC\ApiResponse::error(404, 'not_found', 'Usage rule not found.');
    \ASDC\ApiResponse::ok(['rules' => usage_rules($pdo)]);
}
$service = trim((string)($body['service_name'] ?? ''));
$itemId = \ASDC\InputValidator::positiveId($body['item_id'] ?? null);
$quantity = filter_var($body['quantity_required'] ?? null, FILTER_VALIDATE_INT);
if ($service === '' || mb_strlen($service) > 150 || !$itemId || $quantity === false || $quantity < 1) \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a service, supply, and quantity of at least one.');
if ($method === 'POST') {
    $pdo->prepare('INSERT INTO inventory_usage_rules(service_name,item_id,quantity_required) VALUES(?,?,?)')->execute([$service,$itemId,$quantity]);
} else {
    $id = \ASDC\InputValidator::positiveId($body['rule_id'] ?? null);
    $stmt = $pdo->prepare('UPDATE inventory_usage_rules SET service_name=?,item_id=?,quantity_required=? WHERE rule_id=?'); $stmt->execute([$service,$itemId,$quantity,$id]);
    if (!$stmt->rowCount()) \ASDC\ApiResponse::error(404, 'not_found', 'Usage rule not found.');
}
\ASDC\ApiResponse::ok(['rules' => usage_rules($pdo)]);
