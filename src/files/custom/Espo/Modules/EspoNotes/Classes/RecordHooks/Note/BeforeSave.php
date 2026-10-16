<?php
namespace Espo\Modules\EspoNotes\Classes\RecordHooks\Note;

use DateTimeImmutable;
use DateTimeZone;
use Espo\Core\Acl;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Record\Hook\SaveHook;
use Espo\Entities\User;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

/** @implements SaveHook<\Espo\Modules\EspoNotes\Entities\DovAgentNote> */
class BeforeSave implements SaveHook
{
    public function __construct(private User $user, private EntityManager $entityManager, private Acl $acl) {}

    public function process(Entity $entity): void
    {
        if ($this->user->isPortal()) {
            throw new Forbidden('The notepad is available to internal users only.');
        }
        if ($entity->isNew()) {
            $entity->set('assignedUserId', $this->user->getId());
            $teams = $this->entityManager->getRDBRepository('User')->getRelation($this->user, 'teams')->find();
            $teamIds = [];
            foreach ($teams as $team) { $teamIds[] = $team->getId(); }
            $entity->set('teamsIds', $teamIds);
        } else {
            if (!$this->user->isAdmin() && $entity->getFetched('assignedUserId') !== $this->user->getId()) {
                throw new Forbidden('Only the assigned agent can change this entry.');
            }
            if ($entity->isAttributeChanged('assignedUserId') || $entity->isAttributeChanged('teamsIds')) {
                throw new Forbidden('Ownership and teams cannot be changed.');
            }
        }
        $text = trim((string) $entity->get('description'));
        if ($text === '') { throw new BadRequest('Enter some note text.'); }
        $entity->set('description', $text);
        $entity->set('name', mb_substr(preg_split('/\R/u', $text)[0], 0, 255));

        if ($entity->isAttributeChanged('parentId') || $entity->isAttributeChanged('parentType')) {
            $parentId = $entity->get('parentId');
            $parentType = $entity->get('parentType');
            if ($parentId) {
                if (!in_array($parentType, ['Account', 'Contact', 'Lead', 'Opportunity', 'Case'], true)) {
                    throw new BadRequest('Unsupported related record type.');
                }
                $parent = $this->entityManager->getEntityById($parentType, $parentId);
                if (!$parent || !$this->acl->checkEntityRead($parent)) {
                    throw new Forbidden('The related record is not available.');
                }
            }
        }
        $status = $entity->get('status') ?? 'Open';
        if (!in_array($status, ['Open', 'Completed', 'Archived'], true)) { throw new BadRequest('Invalid note status.'); }
        $minutes = $entity->get('reminderMinutes') ?? 0;
        if (!is_int($minutes) || !in_array($minutes, [-1, 0, 5, 15, 60], true)) {
            throw new BadRequest('Choose a supported popup reminder.');
        }
        if (!$entity->get('isCallback')) {
            $entity->set('dateStart', null);
            $entity->set('reminders', []);
            return;
        }
        $dateString = $entity->get('dateStart');
        $zone = new DateTimeZone('UTC');
        $date = is_string($dateString) ? DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $dateString, $zone) : false;
        if (!$date || $date->format('Y-m-d H:i:s') !== $dateString) {
            throw new BadRequest('Choose a valid callback date and time.');
        }
        if ($status !== 'Open') { $entity->set('reminders', []); return; }
        $scheduleChanged = $entity->isNew();
        foreach (['dateStart', 'isCallback', 'reminderMinutes', 'status'] as $attribute) {
            $scheduleChanged = $scheduleChanged || $entity->isAttributeChanged($attribute);
        }
        if (!$scheduleChanged) {
            // Ignore client reminder arrays and preserve schedules on content-only edits.
            $entity->clear('reminders');
            return;
        }
        $now = new DateTimeImmutable('now', $zone);
        if ($date <= $now) { throw new BadRequest('Choose a callback time in the future.'); }
        if ($minutes >= 0 && $date->modify('-' . $minutes . ' minutes') <= $now) {
            throw new BadRequest('This reminder would be in the past. Choose a shorter reminder.');
        }
        $entity->set('reminders', $minutes < 0 ? [] : [(object) ['type' => 'Popup', 'seconds' => $minutes * 60]]);
    }
}
