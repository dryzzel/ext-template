<?php
use Espo\Core\Container;
use Espo\Core\ORM\EntityManager;
class BeforeUninstall
{
    public function run(Container $container): void
    {
        $em = $container->getByClass(EntityManager::class);
        $query = $em->getQueryBuilder()->delete()->from('Reminder')->where(['entityType' => 'DovAgentNote'])->build();
        $em->getQueryExecutor()->execute($query);
        $writer = $container->getByClass(\Espo\Core\InjectableFactory::class)->create(\Espo\Core\Utils\Config\ConfigWriter::class);
        $writer->set('espoNotesRemindersSuspended', true);
        $writer->save();
        // Keep note records and tab preferences for reinstall.
    }
}
