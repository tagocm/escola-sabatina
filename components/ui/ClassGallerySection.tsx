import { getTeacherGalleryPhotos } from "@/app/actions/gallery";
import ClassGalleryCompactControls, {
  type ClassGalleryCompactPhoto,
} from "@/components/ui/ClassGalleryCompactControls";
import { formatSabbathDateLabel } from "@/lib/gallery/sabbath";

interface ClassGallerySectionProps {
  classId: string;
  weekDate: string;
  periodId: string;
  initialOfferingAmount: number;
  offeringReadOnly: boolean;
  offeringRequiresChangeReason: boolean;
}

export default async function ClassGallerySection({
  classId,
  weekDate,
  periodId,
  initialOfferingAmount,
  offeringReadOnly,
  offeringRequiresChangeReason,
}: ClassGallerySectionProps) {
  const photos = await getTeacherGalleryPhotos(classId, weekDate) as ClassGalleryCompactPhoto[];

  return (
    <section
      id="fotos-da-aula"
      aria-label="Fotos da aula"
      className="flex shrink-0"
    >
      <ClassGalleryCompactControls
        classId={classId}
        weekDate={weekDate}
        sabbathLabel={formatSabbathDateLabel(weekDate)}
        photos={photos}
        periodId={periodId}
        initialOfferingAmount={initialOfferingAmount}
        offeringReadOnly={offeringReadOnly}
        offeringRequiresChangeReason={offeringRequiresChangeReason}
      />
    </section>
  );
}
