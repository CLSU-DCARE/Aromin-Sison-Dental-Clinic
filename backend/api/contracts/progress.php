<?php
/**
 * Braces treatment progress update endpoint for shared dentist/staff access.
 * Delegates to ASDC\ContractService::updateProgress.
 *
 * PATCH /backend/api/contracts/progress.php
 *   Body: { contract_id, current_stage, progress_pct, progress_note?, next_note? }
 */
require_once __DIR__ . '/../../autoload.php';
require_once __DIR__ . '/../../config/headers.php';
require_once __DIR__ . '/../../config/auth.php';

\ASDC\ApiResponse::method('PATCH');
require_role('dentist', 'receptionist');
\ASDC\CsrfToken::requireValid();

$body = \ASDC\ApiResponse::requireJson();

$contractId = \ASDC\InputValidator::positiveId($body['contract_id'] ?? null);
if (!$contractId) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'A valid contract is required.');
}

$pct = filter_var($body['progress_pct'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 100]]);
if ($pct === false) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Please correct the highlighted fields.', ['progress_pct' => 'Enter a percentage between 0 and 100.']);
}
if (!in_array($body['current_stage'] ?? '', \ASDC\ContractService::STAGE_ORDER, true)
    || !is_string($body['progress_note'] ?? '') || mb_strlen($body['progress_note'] ?? '') > 10000
    || !is_string($body['next_note'] ?? '') || mb_strlen($body['next_note'] ?? '') > 255) {
    \ASDC\ApiResponse::error(422, 'validation_failed', 'Choose a valid stage and keep the next-visit note under 256 characters.');
}

$contract = \ASDC\ContractService::updateProgress($contractId, [
    'current_stage'  => is_string($body['current_stage'] ?? null) ? $body['current_stage'] : '',
    'progress_pct'   => $pct,
    'progress_note'  => is_string($body['progress_note'] ?? null) ? trim($body['progress_note']) : '',
    'next_note'      => is_string($body['next_note'] ?? null) ? trim($body['next_note']) : '',
], \ASDC\DataScope::current());

// Real notification to the patient — closes the loop from
// "Dentist updates treatment progress" to the patient actually finding out.
try {
    $stmt = \ASDC\Database::pdo()->prepare('SELECT patient_id FROM braces_contracts WHERE contract_id = ?');
    $stmt->execute([$contractId]);
    $patientId = $stmt->fetchColumn();
    if ($patientId) {
        \ASDC\NotificationSendService::send((int) $patientId, [
            'template_key' => 'braces_progress_updated',
            'replacements' => [
                'stage'   => $contract['progress']['stage'],
                'percent' => (string) $contract['progress']['pct'],
                'note'    => $contract['progress']['note'] ?: '',
            ],
        ]);
    }
} catch (\Throwable $e) {
    error_log('Progress notification failed: ' . $e->getMessage());
}

\ASDC\ApiResponse::ok(['contract' => $contract], 'Progress updated');
