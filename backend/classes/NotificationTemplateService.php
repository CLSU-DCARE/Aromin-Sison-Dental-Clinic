<?php
/**
 * Notification template CRUD: Aromin-Sison Dental Clinic System.
 *
 * Usage:
 *   $templates = NotificationTemplateService::list(true);
 *   $result    = NotificationTemplateService::createOrUpdate($data);
 */

namespace ASDC;

use PDO;

class NotificationTemplateService
{
    public static function list(bool $activeOnly = false): array
    {
        $pdo = Database::pdo();
        $where = $activeOnly ? 'WHERE is_active = 1' : '';
        $stmt = $pdo->query("
            SELECT template_id, template_key, name, channel, subject, body, is_active, created_at, updated_at
            FROM notification_templates
            $where
            ORDER BY name ASC
        ");
        return $stmt->fetchAll();
    }

    public static function getByKey(string $key): ?array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT template_id, channel, subject, body FROM notification_templates WHERE template_key = ? AND is_active = 1');
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Create or update a notification template.
     *
     * @param array{name: string, channel: string, body: string, template_key?: string, subject?: string, is_active?: bool} $data
     * @return array{success: true, action: string, template_key: string}|array{success: false, error: string, code: int}
     */
    public static function createOrUpdate(array $data): array
    {
        $templateKey = trim($data['template_key'] ?? '');
        $name        = trim($data['name'] ?? '');
        $channel     = 'email';
        $subject     = isset($data['subject']) ? trim($data['subject']) : null;
        $body        = trim($data['body'] ?? '');
        $isActive    = $data['is_active'] ?? true;

        if (!$name) {
            return ['success' => false, 'error' => 'name is required.', 'code' => 400];
        }
        if (!$body) {
            return ['success' => false, 'error' => 'body is required.', 'code' => 400];
        }
        if (!$templateKey) {
            $templateKey = preg_replace('/[^a-z0-9]+/', '_', strtolower($name));
            $templateKey = trim($templateKey, '_');
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT template_id FROM notification_templates WHERE template_key = ?');
        $stmt->execute([$templateKey]);
        $existing = $stmt->fetch();

        if ($existing) {
            $stmt = $pdo->prepare('UPDATE notification_templates SET name = ?, channel = ?, subject = ?, body = ?, is_active = ? WHERE template_key = ?');
            $stmt->execute([$name, $channel, $subject, $body, $isActive ? 1 : 0, $templateKey]);
            $action = 'updated';
        } else {
            $stmt = $pdo->prepare('INSERT INTO notification_templates (template_key, name, channel, subject, body, is_active) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$templateKey, $name, $channel, $subject, $body, $isActive ? 1 : 0]);
            $action = 'created';
        }

        return ['success' => true, 'action' => $action, 'template_key' => $templateKey];
    }
}
