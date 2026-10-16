<?php
namespace Espo\Modules\EspoNotes\Classes\Select\Note;
use Espo\Core\Select\Primary\Filter;
use Espo\ORM\Query\SelectBuilder;
class Overdue implements Filter
{
    public function apply(SelectBuilder $queryBuilder): void
    {
        $queryBuilder->where(['status' => 'Open', 'isCallback' => true, 'dateStart<' => gmdate('Y-m-d H:i:s')]);
    }
}
