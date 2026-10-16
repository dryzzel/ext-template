<?php
namespace Espo\Modules\EspoNotes\Classes\FieldProcessing;

use Espo\Core\FieldProcessing\Saver;
use Espo\Core\FieldProcessing\Saver\Params;
use Espo\Core\InjectableFactory;
use Espo\Entities\User;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

/** Preserve this entry's explicit reminder choice when an administrator edits it. */
class ReminderSaver implements Saver
{
    public function __construct(private InjectableFactory $factory, private EntityManager $entityManager) {}

    public function process(Entity $entity, Params $params): void
    {
        $owner = $this->entityManager->getEntityById(User::ENTITY_TYPE, $entity->get('assignedUserId'));
        if (!$owner) { return; }
        $saver = $this->factory->createWith(\Espo\Core\FieldProcessing\Reminder\Saver::class, ['user' => $owner]);
        $saver->process($entity, $params);
    }
}
