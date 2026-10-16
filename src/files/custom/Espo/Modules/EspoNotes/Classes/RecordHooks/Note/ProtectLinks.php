<?php
namespace Espo\Modules\EspoNotes\Classes\RecordHooks\Note;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Record\Hook\LinkHook;
use Espo\Core\Record\Hook\UnlinkHook;
use Espo\ORM\Entity;
class ProtectLinks implements LinkHook, UnlinkHook
{
    public function process(Entity $entity, string $link, Entity $foreignEntity): void
    {
        throw new Forbidden('Use the note editor for record links. Ownership and teams cannot be changed.');
    }
}
