import { getTeacherGalleryPhotos } from "@/app/actions/gallery";
import ClassGalleryCompactControls, {
  type ClassGalleryCompactPhoto,
} from "@/components/ui/ClassGalleryCompactControls";
import { formatSabbathDateLabel } from "@/lib/gallery/sabbath";

interface ClassGallerySectionProps {
  classId: string;
  weekDate: string;
}

export default async function ClassGallerySection({ classId, weekDate }: ClassGallerySectionProps) {
  const photos = await getTeacherGalleryPhotos(classId, weekDate) as ClassGalleryCompactPhoto[];

  return (
    <section
      id="fotos-da-aula"
      aria-label="Fotos da aula"
      className="flex justify-end"
    >
      <ClassGalleryCompactControls
        classId={classId}
        weekDate={weekDate}
        sabbathLabel={formatSabbathDateLabel(weekDate)}
        photos={photos}
      />
    </section>
  );
}
