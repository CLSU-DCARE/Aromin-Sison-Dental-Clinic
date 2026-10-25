<?php
namespace ASDC;

class DuplicatePatientException extends \DomainException
{
    public string $field;

    public function __construct(int $patientId, string $field)
    {
        $this->field = $field;
        $label = ['name'=>'full name', 'email'=>'email address', 'contact_number'=>'contact number'][$field];
        parent::__construct("Patient #P-$patientId already exists with this $label. Use the existing record. A replacement can only be created after that record is archived.");
    }
}
