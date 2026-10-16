<?php
namespace Espo\Modules\EspoNotes\Classes\RecordHooks\Note;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Record\Hook\DeleteHook;
use Espo\Core\Record\DeleteParams;
use Espo\Entities\User;
use Espo\ORM\Entity;
class BeforeDelete implements DeleteHook
{
    public function __construct(private User $user) {}
    public function process(Entity $entity, DeleteParams $params): void
    {
        if ($this->user->isPortal() || (!$this->user->isAdmin() && $entity->get('assignedUserId') !== $this->user->getId())) {
            throw new Forbidden('Only the assigned agent can delete this entry.');
        }
    }
}
