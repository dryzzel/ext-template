<?php

use Espo\Core\Container;
use Espo\Core\InjectableFactory;
use Espo\Core\Utils\Config;
use Espo\Core\Utils\Config\ConfigWriter;
use Espo\ORM\EntityManager;

/** Add navigation and restore future reminders after a previous uninstall. */
class AfterInstall
{
    public function run(Container $container): void
    {
        $em = $container->getByClass(EntityManager::class);

        $configWriter = $container->getByClass(InjectableFactory::class)->create(ConfigWriter::class);

        $config = $container->getByClass(Config::class);
        $tabs = $config->get('tabList') ?? [];
        if (!in_array('DovAgentNote', $tabs, true)) {
            $tabs[] = 'DovAgentNote';
            $configWriter->set('tabList', $tabs);
            $configWriter->save();
        }
        if ($config->get('espoNotesRemindersSuspended')) {
            $saver = $container->getByClass(InjectableFactory::class)->create(
                \Espo\Modules\EspoNotes\Classes\FieldProcessing\ReminderSaver::class
            );
            $notes = $em->getRDBRepository('DovAgentNote')->where([
                'status' => 'Open', 'isCallback' => true, 'dateStart>' => gmdate('Y-m-d H:i:s'), 'reminderMinutes>=' => 0,
            ])->find();
            foreach ($notes as $note) {
                $minutes = $note->get('reminderMinutes');
                if (strtotime($note->get('dateStart') . ' UTC') - $minutes * 60 <= time()) { continue; }
                $note->set('reminders', [(object) ['type' => 'Popup', 'seconds' => $minutes * 60]]);
                $saver->process($note, \Espo\Core\FieldProcessing\Saver\Params::create());
            }
        }
        $configWriter->set('espoNotesRemindersSuspended', false);
        $configWriter->save();
    }
}

