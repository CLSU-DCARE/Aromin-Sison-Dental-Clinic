<?php
/**
 * Template rendering: Aromin-Sison Dental Clinic System.
 *
 * Replaces {placeholders} in a template body.
 * Usage:
 *   $body = TemplateRenderer::render($template, ['patient_name' => 'Juan']);
 */

namespace ASDC;

class TemplateRenderer
{
    public static function render(string $body, array $replacements): string
    {
        $keys = array_map(fn($k) => '{' . $k . '}', array_keys($replacements));
        return str_replace($keys, array_values($replacements), $body);
    }
}
