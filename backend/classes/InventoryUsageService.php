<?php
namespace ASDC;

final class InventoryUsageService
{
    /** Deduct configured supplies once for a completed treatment record. */
    public static function consumeForTreatment(\PDO $pdo, int $recordId, string $serviceName): void
    {
        $serviceName = trim(mb_substr($serviceName, 0, 150));
        if ($recordId < 1 || $serviceName === '') return;

        $rules = $pdo->prepare(
            'SELECT r.item_id, r.quantity_required, i.item_name, i.stock_quantity
             FROM inventory_usage_rules r
             JOIN inventory_items i ON i.item_id=r.item_id
             WHERE r.service_name=? FOR UPDATE'
        );
        $rules->execute([$serviceName]);
        foreach ($rules->fetchAll() as $rule) {
            $alreadyUsed = $pdo->prepare('SELECT 1 FROM inventory_transactions WHERE treatment_record_id=? AND item_id=?');
            $alreadyUsed->execute([$recordId, $rule['item_id']]);
            if ($alreadyUsed->fetchColumn()) continue;
            if ((int) $rule['stock_quantity'] < (int) $rule['quantity_required']) {
                throw new \RuntimeException('Insufficient stock for ' . $rule['item_name'] . '.');
            }
            $pdo->prepare('UPDATE inventory_items SET stock_quantity=stock_quantity-? WHERE item_id=?')
                ->execute([(int) $rule['quantity_required'], (int) $rule['item_id']]);
            $pdo->prepare('INSERT INTO inventory_transactions(item_id,quantity_change,event_type,treatment_record_id,created_by) VALUES(?, ?, ?, ?, ?)')
                ->execute([(int) $rule['item_id'], -((int) $rule['quantity_required']), 'treatment_usage', $recordId, $_SESSION['user_id'] ?? null]);
        }
    }
}
